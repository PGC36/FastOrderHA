const http = require('node:http');

const DEFAULT_TOTAL = 50000;
const DEFAULT_CONCURRENCY = 200;
const DEFAULT_URL = 'http://localhost:8081/api/menu/productos';

const HELP = `
Uso:
  node monitoring/menu-load-test.js [opciones]

Opciones:
  --total <n>        Cantidad de peticiones. Default: ${DEFAULT_TOTAL}
  --concurrency <n>  Peticiones paralelas. Default: ${DEFAULT_CONCURRENCY}
  --url <url>        Endpoint a probar. Default: ${DEFAULT_URL}

Ejemplos:
  node monitoring/menu-load-test.js
  node monitoring/menu-load-test.js --total 50000 --concurrency 100
  node monitoring/menu-load-test.js --url http://localhost:8080/api/menu/productos
`;

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return args[index + 1] || fallback;
}

function numeric(value, label) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} debe ser un numero entero mayor a 0.`);
  }

  return parsed;
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP.trim());
    return;
  }

  const total = numeric(argValue(args, '--total', DEFAULT_TOTAL), 'total');
  const concurrency = numeric(argValue(args, '--concurrency', DEFAULT_CONCURRENCY), 'concurrency');
  const url = new URL(argValue(args, '--url', DEFAULT_URL));
  const statuses = new Map();
  const startedAt = new Date();
  let started = 0;
  let done = 0;
  let ok = 0;
  let failed = 0;

  function requestOnce() {
    if (started >= total) {
      return;
    }

    started += 1;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        timeout: 10000,
      },
      (res) => {
        res.resume();
        res.on('end', () => finish(res.statusCode >= 200 && res.statusCode < 300, res.statusCode));
      },
    );

    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => finish(false, 'error'));
    req.end();
  }

  function finish(success, status) {
    statuses.set(status, (statuses.get(status) || 0) + 1);

    if (success) {
      ok += 1;
    } else {
      failed += 1;
    }

    done += 1;

    if (done % 10000 === 0 || done === total) {
      const seconds = (Date.now() - startedAt.getTime()) / 1000;
      console.log(`done=${done}/${total} ok=${ok} failed=${failed} rate=${(done / seconds).toFixed(1)} req/s`);
    }

    if (started < total) {
      requestOnce();
      return;
    }

    if (done === total) {
      const seconds = (Date.now() - startedAt.getTime()) / 1000;
      console.log('');
      console.log(`FIN total=${total}`);
      console.log(`ok=${ok}`);
      console.log(`failed=${failed}`);
      console.log(`duration=${seconds.toFixed(1)}s`);
      console.log(`avg=${(done / seconds).toFixed(1)} req/s`);
      console.log(`statuses=${JSON.stringify(Object.fromEntries(statuses))}`);
      process.exit(failed === 0 ? 0 : 1);
    }
  }

  console.log(`GET ${url.href}`);
  console.log(`total=${total}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`start=${startedAt.toISOString()}`);

  for (let i = 0; i < Math.min(concurrency, total); i += 1) {
    requestOnce();
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
