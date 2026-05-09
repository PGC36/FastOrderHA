import http from 'k6/http';
import { check } from 'k6';

const rate = Number(__ENV.RATE || 50000);
const duration = __ENV.DURATION || '1s';
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || 1000);
const maxVUs = Number(__ENV.MAX_VUS || 5000);
const baseUrl = __ENV.BASE_URL || 'http://api-gateway:8080';

export const options = {
  scenarios: {
    one_second_spike: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs,
      maxVUs,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/menu/productos/disponibles`);

  check(response, {
    'status is 2xx': (res) => res.status >= 200 && res.status < 300,
  });
}
