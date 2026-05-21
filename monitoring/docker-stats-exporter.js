const http = require('node:http');

const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const port = Number(process.env.PORT || 9104);
const filter = new RegExp(process.env.CONTAINER_FILTER || '^fastorder-');

function dockerRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath, path, method: 'GET' }, (res) => {
      let body = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Docker API ${res.statusCode}: ${body}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function labelValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function serviceName(container) {
  const labels = container.Labels || {};
  const composeService = labels['com.docker.compose.service'];

  if (composeService) {
    return composeService;
  }

  return container.Names?.[0]?.replace(/^\//, '').replace(/^fastorder-/, '') || container.Id.slice(0, 12);
}

function cpuPercent(stats) {
  const cpu = stats.cpu_stats || {};
  const precpu = stats.precpu_stats || {};
  const cpuDelta = (cpu.cpu_usage?.total_usage || 0) - (precpu.cpu_usage?.total_usage || 0);
  const systemDelta = (cpu.system_cpu_usage || 0) - (precpu.system_cpu_usage || 0);
  const onlineCpus = cpu.online_cpus || cpu.cpu_usage?.percpu_usage?.length || 1;

  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }

  return (cpuDelta / systemDelta) * onlineCpus * 100;
}

function memoryUsage(stats) {
  const memory = stats.memory_stats || {};
  const usage = memory.usage || 0;
  const cache = memory.stats?.cache || 0;

  return Math.max(usage - cache, 0);
}

async function collectMetrics() {
  const containers = await dockerRequest('/containers/json?all=true');
  const selected = containers.filter((container) => filter.test(container.Names?.[0]?.replace(/^\//, '') || ''));
  const lines = [
    '# HELP fastorder_container_cpu_percent Docker container CPU percent.',
    '# TYPE fastorder_container_cpu_percent gauge',
    '# HELP fastorder_container_memory_bytes Docker container memory working set bytes.',
    '# TYPE fastorder_container_memory_bytes gauge',
    '# HELP fastorder_container_up Docker container state, 1 running and 0 not running.',
    '# TYPE fastorder_container_up gauge',
  ];

  const samples = await Promise.all(selected.map(async (container) => {
    const name = container.Names[0].replace(/^\//, '');
    const service = serviceName(container);
    const labels = `container="${labelValue(name)}",service="${labelValue(service)}"`;
    const up = container.State === 'running' ? 1 : 0;
    const values = [`fastorder_container_up{${labels}} ${up}`];

    if (!up) {
      values.push(`fastorder_container_cpu_percent{${labels}} 0`);
      values.push(`fastorder_container_memory_bytes{${labels}} 0`);
      return values;
    }

    const stats = await dockerRequest(`/containers/${container.Id}/stats?stream=false`);
    values.push(`fastorder_container_cpu_percent{${labels}} ${cpuPercent(stats).toFixed(6)}`);
    values.push(`fastorder_container_memory_bytes{${labels}} ${memoryUsage(stats)}`);
    return values;
  }));

  lines.push(...samples.flat());

  return `${lines.join('\n')}\n`;
}

const server = http.createServer(async (req, res) => {
  if (req.url !== '/metrics') {
    res.writeHead(404);
    res.end('not found\n');
    return;
  }

  try {
    const metrics = await collectMetrics();
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(metrics);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`docker_stats_exporter_error ${JSON.stringify(error.message)}\n`);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Docker stats exporter listening on :${port}`);
});
