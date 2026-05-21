const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
process.chdir(repoRoot);

const defaults = {
  totalOrders: 50000,
  vus: 100,
  baseUrl: "http://[::1]:8080",
  maxDuration: "30m",
  maxAttempts: 150,
  retryDelaySeconds: 2,
  requestTimeout: "5s",
  iterationDelaySeconds: 0.2,
  killAfterSeconds: [5, 140],
  finalPollIntervalSeconds: 20,
  finalPollTimeoutMinutes: 25,
  disableChaos: false,
  skipCleanup: false,
};

function parseArgs(argv) {
  const options = { ...defaults };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    switch (arg) {
      case "--total-orders":
        options.totalOrders = Number(next());
        break;
      case "--vus":
        options.vus = Number(next());
        break;
      case "--base-url":
        options.baseUrl = next();
        break;
      case "--max-duration":
        options.maxDuration = next();
        break;
      case "--max-attempts":
        options.maxAttempts = Number(next());
        break;
      case "--retry-delay-seconds":
        options.retryDelaySeconds = Number(next());
        break;
      case "--request-timeout":
        options.requestTimeout = next();
        break;
      case "--iteration-delay-seconds":
        options.iterationDelaySeconds = Number(next());
        break;
      case "--kill-after-seconds":
        options.killAfterSeconds = next()
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value));
        break;
      case "--final-poll-interval-seconds":
        options.finalPollIntervalSeconds = Number(next());
        break;
      case "--final-poll-timeout-minutes":
        options.finalPollTimeoutMinutes = Number(next());
        break;
      case "--disable-chaos":
        options.disableChaos = true;
        break;
      case "--skip-cleanup":
        options.skipCleanup = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node monitoring/k6/run-50k-db-chaos.js [options]

Options:
  --total-orders 50000
  --vus 100
  --base-url "http://[::1]:8080"
  --kill-after-seconds "5,140"
  --disable-chaos
  --skip-cleanup

Quick smoke test:
  node monitoring/k6/run-50k-db-chaos.js --total-orders 10 --vus 2 --max-duration 1m --iteration-delay-seconds 0 --disable-chaos
`);
}

function timestamp() {
  return new Date().toISOString();
}

function logLine(filePath, message) {
  fs.appendFileSync(filePath, `${message}\n`, "utf8");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...(options.env || {}) },
  });

  if (result.error) {
    throw result.error;
  }

  if (options.allowFailure !== true && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with code ${result.status}\n${result.stderr || result.stdout}`
    );
  }

  return result;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGateway() {
  const deadline = Date.now() + 3 * 60 * 1000;

  while (Date.now() < deadline) {
    const result = run(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 10 | Out-Null; exit 0 } catch { exit 1 }",
      ],
      { allowFailure: true }
    );

    if (result.status === 0) {
      return;
    }

    await wait(5000);
  }

  throw new Error("API Gateway no respondio /actuator/health antes del timeout.");
}

function resetTestData(totalOrders) {
  console.log("Limpiando datos y preparando inventario...");
  run(
    "docker",
    [
      "exec",
      "-e",
      "PGPASSWORD=fastorder123",
      "fastorder-db",
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "fastorder_user",
      "-d",
      "fastorder_db",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `truncate table delivery_status_history, delivery_orders, kitchen_orders, notifications, outbox_events, inventory_sales, inventory_reservations, orders restart identity cascade; update inventory set quantity = ${totalOrders}, reserved = 0, sold = 0 where product_id = 1;`,
    ],
    { stdio: "inherit" }
  );

  run("docker", ["exec", "fastorder-redis", "redis-cli", "FLUSHALL"]);
}

function getPrimaryDbContainer(chaosLog) {
  for (const node of ["fastorder-db-0", "fastorder-db-1"]) {
    const result = run(
      "docker",
      [
        "exec",
        "-e",
        "PGPASSWORD=fastorder123",
        node,
        "psql",
        "-U",
        "fastorder_user",
        "-d",
        "fastorder_db",
        "-tAc",
        "select case when pg_is_in_recovery() then 'replica' else 'primary' end",
      ],
      { allowFailure: true }
    );

    if (result.status !== 0) {
      logLine(chaosLog, `${timestamp()} No se pudo consultar rol de ${node}: ${result.stderr.trim()}`);
      continue;
    }

    if (result.stdout.trim() === "primary") {
      return node;
    }
  }

  return null;
}

function killPrimaryDb(chaosLog) {
  const primary = getPrimaryDbContainer(chaosLog);
  if (!primary) {
    logLine(chaosLog, `${timestamp()} No primary detected`);
    return;
  }

  logLine(chaosLog, `${timestamp()} Killing primary ${primary}`);
  const result = run("docker", ["kill", primary], { allowFailure: true });
  logLine(chaosLog, (result.stdout || result.stderr).trim());
}

async function runChaos(options, chaosLog) {
  if (options.disableChaos) {
    logLine(chaosLog, `${timestamp()} Chaos disabled`);
    return;
  }

  let elapsed = 0;
  for (const killAt of options.killAfterSeconds) {
    const sleepFor = Math.max(0, killAt - elapsed);
    await wait(sleepFor * 1000);
    elapsed = killAt;
    killPrimaryDb(chaosLog);
  }

  logLine(chaosLog, `${timestamp()} Chaos script finished`);
}

function runK6(options, runId, resultLog) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const k6Command = process.platform === "win32" ? "k6.exe" : "k6";
    const env = {
      ...process.env,
      TOTAL_ORDERS: String(options.totalOrders),
      VUS: String(options.vus),
      MAX_DURATION: options.maxDuration,
      MAX_ATTEMPTS: String(options.maxAttempts),
      RETRY_DELAY_SECONDS: String(options.retryDelaySeconds),
      REQUEST_TIMEOUT: options.requestTimeout,
      ITERATION_DELAY_SECONDS: String(options.iterationDelaySeconds),
      BASE_URL: options.baseUrl,
      RUN_ID: runId,
    };

    const child = spawn(k6Command, ["run", ".\\monitoring\\k6\\order-write-resilient-test.js"], {
      cwd: repoRoot,
      env,
    });

    const stream = fs.createWriteStream(resultLog, { flags: "a", encoding: "utf8" });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      stream.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      stream.write(chunk);
    });
    child.on("error", (error) => {
      stream.end();
      reject(error);
    });
    child.on("close", (code) => {
      const elapsedSeconds = Math.round(((Date.now() - started) / 1000) * 100) / 100;
      const footer = `K6_EXIT_CODE=${code}\nK6_ELAPSED_SECONDS=${elapsedSeconds}\nEND=${timestamp()}\n`;
      process.stdout.write(footer);
      stream.end(footer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`k6 termino con codigo ${code}`));
      }
    });
  });
}

async function waitFinalBusinessState(options, finalLog, scriptStarted) {
  const deadline = Date.now() + options.finalPollTimeoutMinutes * 60 * 1000;

  while (Date.now() < deadline) {
    const result = run("node", [".\\monitoring\\check-results.js"]);
    const elapsed = Math.round(((Date.now() - scriptStarted) / 1000) * 100) / 100;
    const header = `===== POLL ${timestamp()} elapsed=${elapsed}s =====`;
    const output = result.stdout.trim();

    console.log(header);
    console.log(output);
    logLine(finalLog, header);
    logLine(finalLog, output);

    if (output.includes("Status: DONE")) {
      return true;
    }

    await wait(options.finalPollIntervalSeconds * 1000);
  }

  return false;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scriptStarted = Date.now();
  const runId = `db-chaos-50k-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
  const resultLog = path.join(repoRoot, "monitoring", "k6", "last-50k-db-chaos-result.txt");
  const chaosLog = path.join(repoRoot, "monitoring", "k6", "last-50k-db-chaos-events.txt");
  const finalLog = path.join(repoRoot, "monitoring", "k6", "last-50k-db-chaos-final.txt");

  fs.writeFileSync(
    resultLog,
    `RUN_ID=${runId}\nBASE_URL=${options.baseUrl}\nTOTAL_ORDERS=${options.totalOrders}\nVUS=${options.vus}\nSTART=${timestamp()}\n`,
    "utf8"
  );
  fs.writeFileSync(
    chaosLog,
    `RUN_ID=${runId}\nKILL_AFTER_SECONDS=${options.killAfterSeconds.join(",")}\nDISABLE_CHAOS=${options.disableChaos}\nSTART=${timestamp()}\n`,
    "utf8"
  );
  fs.writeFileSync(finalLog, `RUN_ID=${runId}\nSTART=${timestamp()}\n`, "utf8");

  console.log(`RUN_ID=${runId}`);
  console.log("Logs:");
  console.log(`  k6:    ${resultLog}`);
  console.log(`  chaos: ${chaosLog}`);
  console.log(`  final: ${finalLog}`);

  await waitForGateway();

  if (!options.skipCleanup) {
    resetTestData(options.totalOrders);
  }

  console.log(run("node", [".\\monitoring\\check-results.js"]).stdout);

  await Promise.all([
    runK6(options, runId, resultLog),
    runChaos(options, chaosLog),
  ]);

  const done = await waitFinalBusinessState(options, finalLog, scriptStarted);
  if (!done) {
    throw new Error(`La saga no llego a Status: DONE dentro de ${options.finalPollTimeoutMinutes} minutos.`);
  }

  console.log("Prueba completada: Status DONE.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
