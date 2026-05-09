import http from 'k6/http';
import { check, sleep } from 'k6';

const totalRequests = Number(__ENV.TOTAL_REQUESTS || 50000);
const vus = Number(__ENV.VUS || 200);
const baseUrl = __ENV.BASE_URL || 'http://api-gateway:8080';
const sleepSeconds = Number(__ENV.SLEEP_SECONDS || 0);

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    fastorder_read_stress: {
      executor: 'shared-iterations',
      vus,
      iterations: totalRequests,
      maxDuration: __ENV.MAX_DURATION || '1m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    checks: ['rate>0.95'],
  },
};

const endpoints = [
  '/api/menu/productos',
  '/api/menu/productos/disponibles',
  '/api/orders',
  '/api/inventory/check?productId=1&quantity=1',
];

export default function () {
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const response = http.get(`${baseUrl}${endpoint}`, {
    tags: {
      endpoint,
    },
  });

  check(response, {
    'status is 2xx': (res) => res.status >= 200 && res.status < 300,
  });

  if (sleepSeconds > 0) {
    sleep(sleepSeconds);
  }
}
