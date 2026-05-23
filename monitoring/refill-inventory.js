const { execFileSync } = require('node:child_process');

const DEFAULT_PRODUCT_ID = 1;
const DEFAULT_QUANTITY = 75000;
const DB_PASSWORD = process.env.DB_PASSWORD || 'fastorder123';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_NAME = process.env.DB_NAME || 'fastorder_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_NODES = ['fastorder-db-0', 'fastorder-db-1', 'fastorder-db-2'];

const HELP = `
Uso:
  node monitoring/refill-inventory.js [cantidad] [opciones]

Ejemplos:
  node monitoring/refill-inventory.js
  node monitoring/refill-inventory.js 75000
  node monitoring/refill-inventory.js 100000 --product 1
  node monitoring/refill-inventory.js 10000 --add
  node monitoring/refill-inventory.js 75000 --reset-counters

Opciones:
  --product <id>      Producto a rellenar. Default: ${DEFAULT_PRODUCT_ID}
  --set               Fija quantity exactamente a la cantidad indicada. Default.
  --add               Suma la cantidad indicada al quantity actual.
  --reset-counters    Tambien pone reserved=0 y sold=0.
  --container <name>  Contenedor Postgres especifico. Si no se indica, detecta el primary.
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

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} debe ser un numero entero mayor o igual a 0.`);
  }

  return parsed;
}

function psql(container, sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-e',
      `PGPASSWORD=${DB_PASSWORD}`,
      container,
      'psql',
      '-h',
      DB_HOST,
      '-p',
      '5432',
      '-U',
      DB_USER,
      '-d',
      DB_NAME,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

function detectPrimaryDbContainer() {
  for (const node of DB_NODES) {
    try {
      const output = execFileSync(
        'docker',
        [
          'exec',
          '-e',
          `PGPASSWORD=${DB_PASSWORD}`,
          node,
          'psql',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
          '-d',
          DB_NAME,
          '-tAc',
          "select case when pg_is_in_recovery() then 'replica' else 'primary' end",
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim();

      if (output === 'primary') {
        return node;
      }
    } catch {
      // Intentamos con el siguiente nodo.
    }
  }

  throw new Error('No pude detectar el nodo primario de PostgreSQL.');
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP.trim());
    return;
  }

  const quantityArg = args.find((arg) => !arg.startsWith('--') && !['--product', '--container'].includes(args[args.indexOf(arg) - 1]));
  const quantity = numeric(quantityArg || DEFAULT_QUANTITY, 'cantidad');
  const productId = numeric(argValue(args, '--product', DEFAULT_PRODUCT_ID), 'product');
  const container = argValue(args, '--container', '') || detectPrimaryDbContainer();
  const addMode = args.includes('--add');
  const resetCounters = args.includes('--reset-counters');

  const quantityExpression = addMode ? `inventory.quantity + ${quantity}` : `${quantity}`;
  const counterSql = resetCounters ? ', reserved = 0, sold = 0' : '';
  const insertReserved = resetCounters ? '0' : '0';
  const insertSold = resetCounters ? '0' : '0';

  const sql = `
    insert into inventory (product_id, quantity, reserved, sold)
    values (${productId}, ${quantity}, ${insertReserved}, ${insertSold})
    on conflict (product_id) do update
       set quantity = ${quantityExpression}${counterSql},
           updated_at = current_timestamp;

    select product_id, quantity, reserved, sold
      from inventory
     where product_id = ${productId};
  `;

  console.log(`DB node: ${container}`);
  console.log(`${addMode ? 'Sumando' : 'Fijando'} inventario: product_id=${productId}, cantidad=${quantity}`);
  if (resetCounters) {
    console.log('Tambien se reinician reserved y sold a 0.');
  }

  const output = psql(container, sql);
  console.log(output.trim());
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
