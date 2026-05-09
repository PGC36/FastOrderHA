import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const rate = Number(__ENV.RATE || 250);
const duration = __ENV.DURATION || '5m';
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || 300);
const maxVUs = Number(__ENV.MAX_VUS || 1000);
const baseUrl = __ENV.BASE_URL || 'http://api-gateway:8080';
const runId = __ENV.RUN_ID || `${Date.now()}`;

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    sustained_order_writes: {
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
    http_req_duration: ['p(95)<5000', 'p(99)<8000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const iteration = exec.scenario.iterationInTest;
  const payload = JSON.stringify({
    productId: 1,
    quantity: 1,
    idempotencyKey: `k6-sustained-${runId}-${iteration}`,
    deliveryAddress: `Zona sostenida ${iteration % 25}`,
    notificationChannel: 'EMAIL',
    notificationRecipient: `sustained-${iteration}@fastorder.test`,
  });

  const response = http.post(`${baseUrl}/api/orders`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: {
      endpoint: '/api/orders',
      test_type: 'sustained-write',
    },
  });

  check(response, {
    'order accepted or already known': (res) => res.status === 201 || res.status === 200,
    'order accepted for processing': (res) => {
      try {
        return ['PENDING', 'PROCESSING', 'READY_FOR_DELIVERY', 'COMPLETED'].includes(res.json('status'));
      } catch (_) {
        return false;
      }
    },
  });
}
