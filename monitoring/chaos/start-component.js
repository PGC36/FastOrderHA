const { execFileSync } = require('node:child_process');

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
  'redis': 'fastorder-redis',
  'rabbitmq': 'fastorder-rabbitmq',
  'pgpool': 'fastorder-db',
  'db-pgpool': 'fastorder-db',
  'db-0': 'fastorder-db-0',
  'db-1': 'fastorder-db-1',
  'recovery': 'fastorder-db-recovery',
};

const HELP = `
Uso:
  node monitoring/chaos/start-component.js <componente>

Componentes:
  api, menu, inventory, order, kitchen, delivery, notification
  redis, rabbitmq, pgpool, db-0, db-1, recovery
`;

function docker(args, options = {}) {
  const output = execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });

  return typeof output === 'string' ? output.trim() : '';
}

function inspect(container, format) {
  try {
    return docker(['inspect', '-f', format, container]);
  } catch {
    return '';
  }
}

function main() {
  const component = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

  if (!component || process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP.trim());
    return;
  }

  const container = ALIASES[component];

  if (!container) {
    throw new Error(`Componente desconocido: ${component}`);
  }

  const status = inspect(container, '{{.State.Status}}') || 'missing';

  if (status === 'missing') {
    throw new Error(`No existe el contenedor ${container}.`);
  }

  if (status === 'running') {
    console.log(`${container} ya esta corriendo.`);
    return;
  }

  console.log(`Levantando ${container}...`);
  docker(['start', container], { stdio: 'inherit' });
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
