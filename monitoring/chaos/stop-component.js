const { execFileSync } = require('node:child_process');
const DB_PASSWORD = process.env.DB_PASSWORD || 'fastorder123';
const DB_NAME = process.env.DB_NAME || 'fastorder_db';

const ALIASES = {
  'api': 'fastorder-api-gateway',
  'api-gateway': 'fastorder-api-gateway',
  'menu': 'fastorder-menu-service',
  'menu-service': 'fastorder-menu-service',
  'inventory': 'fastorder-inventory-service',
  'inventory-service': 'fastorder-inventory-service',
  'order': 'fastorder-order-service',
  'orders': 'fastorder-order-service',
  'order-service': 'fastorder-order-service',
  'kitchen': 'fastorder-kitchen-service',
  'kitchen-service': 'fastorder-kitchen-service',
  'delivery': 'fastorder-delivery-service',
  'delivery-service': 'fastorder-delivery-service',
  'notification': 'fastorder-notification-service',
  'notification-service': 'fastorder-notification-service',
  'rabbitmq': 'fastorder-rabbitmq',
  'db-proxy': 'fastorder-db',
  'db-0': 'fastorder-db-0',
  'db-1': 'fastorder-db-1',
  'db-2': 'fastorder-db-2',
  'db-primary': 'PRIMARY',
  'db-replica': 'REPLICA',
};

const HELP = `
Uso:
  node monitoring/chaos/stop-component.js <componente> [--keep-down]

Componentes:
  api, menu, inventory, order, kitchen, delivery, notification
  rabbitmq, db-proxy, db-0, db-1, db-2, db-primary, db-replica

Opciones:
  --keep-down   Detiene fastorder-db-recovery antes de parar el componente.
                Usalo solo si queres que la caida dure hasta que lo levantes manualmente.
`;

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });

  return typeof output === 'string' ? output.trim() : '';
}

function docker(args, options = {}) {
  return run('docker', args, options);
}

function inspect(container, format) {
  try {
    return docker(['inspect', '-f', format, container]);
  } catch {
    return '';
  }
}

function isPrimary(container) {
  try {
    const result = docker([
      'exec',
      '-e',
      `PGPASSWORD=${DB_PASSWORD}`,
      container,
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      'postgres',
      '-d',
      DB_NAME,
      '-tAc',
      "select case when pg_is_in_recovery() then 'replica' else 'primary' end",
    ]);
    return result === 'primary';
  } catch {
    return false;
  }
}

function resolveDbRole(role) {
  const nodes = ['fastorder-db-0', 'fastorder-db-1', 'fastorder-db-2'];
  const primary = nodes.find(isPrimary);

  if (!primary) {
    throw new Error('No pude detectar la primaria. Verifica que fastorder-db-0, fastorder-db-1 y fastorder-db-2 esten arriba.');
  }

  if (role === 'PRIMARY') {
    return primary;
  }

  const replica = nodes.find((node) => node !== primary);

  if (!replica) {
    throw new Error('No pude detectar una replica disponible.');
  }

  return replica;
}

function resolveContainer(component) {
  const alias = ALIASES[component];

  if (!alias) {
    throw new Error(`Componente desconocido: ${component}`);
  }

  if (alias === 'PRIMARY' || alias === 'REPLICA') {
    return resolveDbRole(alias);
  }

  return alias;
}

function stopContainer(container) {
  const status = inspect(container, '{{.State.Status}}') || 'missing';

  if (status === 'missing') {
    throw new Error(`No existe el contenedor ${container}.`);
  }

  if (status !== 'running') {
    console.log(`${container} ya esta en estado ${status}.`);
    return;
  }

  console.log(`Deteniendo ${container}...`);
  docker(['stop', container], { stdio: 'inherit' });
}

function main() {
  const args = process.argv.slice(2);
  const component = args.find((arg) => !arg.startsWith('--'));
  const keepDown = args.includes('--keep-down');

  if (!component || args.includes('--help') || args.includes('-h')) {
    console.log(HELP.trim());
    return;
  }

  if (keepDown) {
    stopContainer('fastorder-db-recovery');
  }

  const container = resolveContainer(component);
  stopContainer(container);

  if (!keepDown) {
    console.log('Nota: fastorder-db-recovery puede levantarlo automaticamente en unos segundos.');
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
