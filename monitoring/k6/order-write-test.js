import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const totalOrders = Number(__ENV.TOTAL_ORDERS || 50000);
const vus = Number(__ENV.VUS || 200);
const baseUrl = __ENV.BASE_URL || 'http://api-gateway:8080';
const runId = __ENV.RUN_ID || `${Date.now()}`;

export const options = {
  scenarios: {
    create_orders: {
      executor: 'shared-iterations',
      vus,
      iterations: totalOrders,
      maxDuration: __ENV.MAX_DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
    checks: ['rate>0.90'],
  },
};

export default function () {
  const iteration = exec.scenario.iterationInTest;
  const payload = JSON.stringify({
    productId: 1,
    quantity: 1,
    idempotencyKey: `k6-real-${runId}-${iteration}`,
    deliveryAddress: `Zona k6 ${iteration % 25}`,
    notificationChannel: 'EMAIL',
    notificationRecipient: `load-${iteration}@fastorder.test`,
  });

  const response = http.post(`${baseUrl}/api/orders`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: {
      endpoint: '/api/orders',
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
