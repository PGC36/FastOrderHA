const { execFileSync } = require("node:child_process");
const http = require("node:http");

const DB_CONTAINER = process.env.DB_CONTAINER || "";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const RABBIT_CONTAINER = process.env.RABBIT_CONTAINER || "fastorder-rabbitmq";
const DB_USER = process.env.DB_USER || "fastorder_user";
const DB_NAME = process.env.DB_NAME || "fastorder_db";
const DB_PASSWORD = process.env.DB_PASSWORD || "fastorder123";
const EXPECTED_ORDERS = Number(process.env.EXPECTED_ORDERS || process.env.TOTAL_ORDERS || 0);
const NO_CLEAR = process.env.NO_CLEAR === "1";
const DB_FALLBACK_IMAGE = process.env.DB_FALLBACK_IMAGE || "postgres:16";
const PATRONI_ENDPOINTS = (process.env.PATRONI_ENDPOINTS || "http://192.168.0.2:8008,http://192.168.0.5:8108,http://192.168.0.6:8008")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const WATCH = process.argv.includes("--watch");
const INTERVAL_SECONDS = Number(process.env.INTERVAL_SECONDS || 10);
const DB_NODES = ["fastorder-db-0", "fastorder-db-1", "fastorder-db-2"];

let resolvedDbContainer = DB_CONTAINER;

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
  }).trim();
}

function queryViaDockerRun(args) {
  return run("docker", [
    "run",
    "--rm",
    "--network",
    "fastorder-network",
    "-e",
    `PGPASSWORD=${DB_PASSWORD}`,
    DB_FALLBACK_IMAGE,
    ...args,
  ]);
}

function detectPrimaryDbContainer() {
  for (const node of DB_NODES) {
    try {
      const result = run("docker", [
        "exec",
        "-e",
        `PGPASSWORD=${DB_PASSWORD}`,
        node,
        "psql",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "fastorder_db",
        "-tAc",
        "select case when pg_is_in_recovery() then 'replica' else 'primary' end",
      ]);

      if (result.trim() === "primary") {
        return node;
      }
    } catch {
      // Intentamos con el siguiente nodo.
    }
  }

  throw new Error("No pude detectar el nodo primario de PostgreSQL.");
}

function detectReadableDbContainer() {
  for (const node of DB_NODES) {
    try {
      run("docker", [
        "exec",
        "-e",
        `PGPASSWORD=${DB_PASSWORD}`,
        node,
        "psql",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        DB_NAME,
        "-tAc",
        "select 1",
      ]);
      return node;
    } catch {
      // Intentamos con el siguiente nodo.
    }
  }

  throw new Error("No pude encontrar un nodo PostgreSQL local accesible para lectura.");
}

function getDbContainer() {
  if (resolvedDbContainer) {
    return resolvedDbContainer;
  }

  if (DB_CONTAINER) {
    resolvedDbContainer = DB_CONTAINER;
    return resolvedDbContainer;
  }

  try {
    resolvedDbContainer = detectReadableDbContainer();
  } catch {
    resolvedDbContainer = "__docker_run__";
  }
  return resolvedDbContainer;
}

function psql(sql) {
  if (getDbContainer() === "__docker_run__") {
    return queryViaDockerRun([
      "psql",
      "-h",
      DB_HOST,
      "-U",
      DB_USER,
      "-d",
      DB_NAME,
      "-At",
      "-F",
      "|",
      "-c",
      sql,
    ]);
  }

  return run("docker", [
    "exec",
    "-e",
    `PGPASSWORD=${DB_PASSWORD}`,
    getDbContainer(),
    "psql",
    "-h",
    DB_HOST,
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
    "-At",
    "-F",
    "|",
    "-c",
    sql,
  ]);
}

function rows(output) {
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|"));
}

function number(value) {
  return Number(value || 0);
}

function getOrdersByStatus() {
  return Object.fromEntries(
    rows(psql("select status, count(*) from orders group by status order by status;"))
      .map(([status, count]) => [status, number(count)])
  );
}

function getSingleCount(sql) {
  const result = rows(psql(sql));
  return result.length ? number(result[0][0]) : 0;
}

function getOutbox() {
  return Object.fromEntries(
    rows(psql("select processed::text, count(*) from outbox_events group by processed order by processed;"))
      .map(([processed, count]) => [processed === "t" || processed === "true" ? "processed" : "pending", number(count)])
  );
}

function getInventory() {
  return rows(psql("select product_id, quantity, reserved, sold from inventory order by product_id;"))
    .map(([productId, quantity, reserved, sold]) => ({
      productId,
      quantity: number(quantity),
      reserved: number(reserved),
      sold: number(sold),
    }));
}

function getRabbitQueues() {
  const output = run("docker", [
    "exec",
    RABBIT_CONTAINER,
    "rabbitmqctl",
    "list_queues",
    "name",
    "messages_ready",
    "messages_unacknowledged",
  ]);

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Timeout:") && !line.startsWith("Listing") && !line.startsWith("name"))
    .map((line) => {
      const [name, ready, unacked] = line.split(/\s+/);
      return {
        name,
        ready: number(ready),
        unacked: number(unacked),
      };
    });
}

function formatStatus(statuses) {
  const entries = Object.entries(statuses);
  return entries.length ? entries.map(([status, count]) => `${status}: ${count}`).join(" | ") : "sin ordenes";
}

function getPatroniNodeState(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 2000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          const payload = JSON.parse(body);
          resolve({
            url,
            ok: true,
            state: payload.state || "unknown",
            role: payload.role || "unknown",
            name: payload.patroni?.name || payload.name || "unknown",
          });
        } catch {
          resolve({ url, ok: false, state: "unreachable", role: "unknown", name: "unknown" });
        }
      });
    });

    request.on("error", () => resolve({ url, ok: false, state: "unreachable", role: "unknown", name: "unknown" }));
    request.on("timeout", () => {
      request.destroy();
      resolve({ url, ok: false, state: "timeout", role: "unknown", name: "unknown" });
    });
  });
}

async function getPatroniStates() {
  const states = await Promise.all(PATRONI_ENDPOINTS.map(getPatroniNodeState));
  return states;
}

async function printReport() {
  const container = getDbContainer();
  const statuses = getOrdersByStatus();
  const outbox = getOutbox();
  const inventory = getInventory();
  const patroniStates = await getPatroniStates();
  const inventorySales = getSingleCount("select count(*) from inventory_sales;");
  const notifications = getSingleCount("select count(*) from notifications;");
  const orderTotals = rows(psql("select count(*), count(distinct idempotency_key) from orders;"))[0] || ["0", "0"];
  const queues = getRabbitQueues();
  const activeQueues = queues.filter((queue) => queue.ready > 0 || queue.unacked > 0);
  const totalOrders = number(orderTotals[0]);
  const uniqueKeys = number(orderTotals[1]);
  const pendingOutbox = outbox.pending || 0;
  const processedOutbox = outbox.processed || 0;
  const completedOrders = Object.entries(statuses)
    .filter(([status]) => ["COMPLETED", "CANCELLED", "ABANDONED", "DELIVERY_ABANDONED"].includes(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const expectedProgress = EXPECTED_ORDERS > 0 ? `${completedOrders}/${EXPECTED_ORDERS}` : "n/a";

  if (!NO_CLEAR) {
    console.clear();
  }
  console.log(`FastOrder HA results - ${new Date().toLocaleString()}`);
  console.log(`DB node for queries: ${container}`);
  console.log("");
  console.log("Patroni cluster:");
  patroniStates.forEach((node) => {
    console.log(`  ${node.name} @ ${node.url}: role=${node.role}, state=${node.state}, reachable=${node.ok}`);
  });
  console.log("");
  console.log(`Orders: ${formatStatus(statuses)}`);
  console.log(`Orders total: ${totalOrders}`);
  console.log(`Orders final progress: ${expectedProgress}`);
  console.log(`Idempotency keys unique: ${uniqueKeys}`);
  console.log("");
  console.log(`Outbox processed: ${processedOutbox}`);
  console.log(`Outbox pending: ${pendingOutbox}`);
  console.log("");
  console.log("Inventory:");
  inventory.forEach((item) => {
    console.log(
      `  product ${item.productId}: quantity=${item.quantity}, reserved=${item.reserved}, sold=${item.sold}`
    );
  });
  console.log(`Inventory sales: ${inventorySales}`);
  console.log(`Notifications: ${notifications}`);
  console.log("");

  if (activeQueues.length === 0) {
    console.log("Rabbit queues: empty");
  } else {
    console.log("Rabbit queues with messages:");
    activeQueues.forEach((queue) => {
      console.log(`  ${queue.name}: ready=${queue.ready}, unacked=${queue.unacked}`);
    });
  }

  const pendingOrders = Object.entries(statuses)
    .filter(([status]) => !["COMPLETED", "CANCELLED", "ABANDONED", "DELIVERY_ABANDONED"].includes(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const reserved = inventory.reduce((sum, item) => sum + item.reserved, 0);
  const activeQueueMessages = activeQueues.reduce((sum, queue) => sum + queue.ready + queue.unacked, 0);
  const done = pendingOrders === 0 && pendingOutbox === 0 && reserved === 0 && activeQueueMessages === 0;

  console.log("");
  console.log(done ? "Status: DONE" : "Status: PROCESSING");
}

async function main() {
  await printReport();

  if (WATCH) {
    setInterval(() => {
      printReport().catch((error) => {
        console.error(`Status: ERROR\n${error.message}`);
      });
    }, INTERVAL_SECONDS * 1000);
  }
}

main().catch((error) => {
  console.error(`Status: ERROR\n${error.message}`);
  process.exit(1);
});
