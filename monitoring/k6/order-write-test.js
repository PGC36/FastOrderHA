import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const totalOrders = Number(__ENV.TOTAL_ORDERS || 50000);
const vus = Number(__ENV.VUS || 200);
const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const runId = __ENV.RUN_ID || `local-${Date.now()}`;
const maxAttempts = Number(__ENV.MAX_ATTEMPTS || 10);
const retryDelaySeconds = Number(__ENV.RETRY_DELAY_SECONDS || 2);
const requestTimeout = __ENV.REQUEST_TIMEOUT || '5s';
const maxDuration = __ENV.MAX_DURATION || '10m';
const resultPath = __ENV.RESULT_PATH || 'monitoring/k6/last-50k-result.txt';
const startedAt = new Date().toISOString();

const finalOrderFailed = new Rate('final_order_failed');
const recoveredOrders = new Counter('recovered_orders');
const retryAttempts = new Counter('retry_attempts');
const attemptsPerOrder = new Trend('attempts_per_order');

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    create_orders: {
      executor: 'shared-iterations',
      vus,
      iterations: totalOrders,
      maxDuration,
    },
  },
  thresholds: {
    final_order_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<8000', 'p(99)<12000'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  console.log(`RUN_ID=${runId}`);
  console.log(`BASE_URL=${baseUrl}`);
  console.log(`TOTAL_ORDERS=${totalOrders}`);
  console.log(`VUS=${vus}`);
  console.log(`MAX_DURATION=${maxDuration}`);
  console.log(`MAX_ATTEMPTS=${maxAttempts}`);
  console.log(`RETRY_DELAY_SECONDS=${retryDelaySeconds}`);
  console.log(`REQUEST_TIMEOUT=${requestTimeout}`);
  console.log(`RESULT_PATH=${resultPath}`);
  console.log(`START=${startedAt}`);
}

function isAccepted(response) {
  if (!response || ![200, 201].includes(response.status)) {
    return false;
  }

  try {
    return ['PENDING', 'PROCESSING', 'READY_FOR_DELIVERY', 'COMPLETED'].includes(response.json('status'));
  } catch (_) {
    return false;
  }
}

function shouldRetry(response) {
  if (!response) {
    return true;
  }

  return [0, 408, 429, 500, 502, 503, 504].includes(response.status);
}

function createPayload(iteration) {
  return JSON.stringify({
    productId: 1,
    quantity: 1,
    idempotencyKey: `k6-real-${runId}-${iteration}`,
    deliveryAddress: `Zona k6 ${iteration % 25}`,
    notificationChannel: 'EMAIL',
    notificationRecipient: `load-${iteration}@fastorder.test`,
  });
}

export default function () {
  const iteration = exec.scenario.iterationInTest;
  const payload = createPayload(iteration);
  let response;
  let accepted = false;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;

    try {
      response = http.post(`${baseUrl}/api/orders`, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        tags: {
          endpoint: '/api/orders',
        },
        timeout: requestTimeout,
      });
    } catch (_) {
      response = null;
    }

    if (isAccepted(response)) {
      accepted = true;
      break;
    }

    if (attempt < maxAttempts && shouldRetry(response)) {
      retryAttempts.add(1);
      sleep(retryDelaySeconds);
      continue;
    }

    break;
  }

  attemptsPerOrder.add(attempts);
  finalOrderFailed.add(!accepted);

  if (accepted && attempts > 1) {
    recoveredOrders.add(1);
  }

  check({ accepted, attempts }, {
    'order eventually accepted': (result) => result.accepted,
    'order finished within retry budget': (result) => result.attempts <= maxAttempts,
  });
}

export function handleSummary(data) {
  const endedAt = new Date().toISOString();
  const header = [
    `RUN_ID=${runId}`,
    `BASE_URL=${baseUrl}`,
    `TOTAL_ORDERS=${totalOrders}`,
    `VUS=${vus}`,
    `MAX_DURATION=${maxDuration}`,
    `MAX_ATTEMPTS=${maxAttempts}`,
    `RETRY_DELAY_SECONDS=${retryDelaySeconds}`,
    `REQUEST_TIMEOUT=${requestTimeout}`,
    `START=${startedAt}`,
    `END=${endedAt}`,
    '',
  ].join('\n');
  const summary = textSummary(data, { indent: ' ', enableColors: false });

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [resultPath]: `${header}${summary}\n`,
  };
}
