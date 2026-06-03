const RABBIT_URL = process.env.RABBIT_URL || "http://rabbitmq:15672/api";
const RABBIT_USER = process.env.RABBIT_USER || "guest";
const RABBIT_PASSWORD = process.env.RABBIT_PASSWORD || "guest";
const INTERVAL_SECONDS = Number(process.env.INTERVAL_SECONDS || 15);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 100);
const WATCH = process.argv.includes("--watch");

const bindings = [
  ["inventory.order-created.queue.dlq", "order.exchange", "order.event"],
  ["inventory.delivery-completed.queue.dlq", "delivery.exchange", "delivery.completed"],
  ["kitchen.inventory-reserved.queue.dlq", "inventory.exchange", "inventory.reserved"],
  ["delivery.kitchen-ready.queue.dlq", "kitchen.exchange", "kitchen.ready"],
  ["order.inventory-rejected.queue.dlq", "inventory.exchange", "inventory.rejected"],
  ["order.kitchen-failed.queue.dlq", "kitchen.exchange", "kitchen.failed"],
  ["order.delivery-completed.queue.dlq", "delivery.exchange", "delivery.completed"],
  ["order.delivery-failed.queue.dlq", "delivery.exchange", "delivery.failed"],
  ["notification.created.queue.dlq", "notification.exchange", "notification.created"],
];

function authHeader() {
  return `Basic ${Buffer.from(`${RABBIT_USER}:${RABBIT_PASSWORD}`).toString("base64")}`;
}

async function rabbit(path, body) {
  const response = await fetch(`${RABBIT_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getMessages(queueName) {
  return rabbit(`/queues/%2F/${encodeURIComponent(queueName)}/get`, {
    count: BATCH_SIZE,
    ackmode: "ack_requeue_false",
    encoding: "auto",
    truncate: 50000,
  });
}

async function publish(exchange, routingKey, payload) {
  return rabbit(`/exchanges/%2F/${encodeURIComponent(exchange)}/publish`, {
    properties: {
      content_type: "application/json",
      delivery_mode: 2,
    },
    routing_key: routingKey,
    payload,
    payload_encoding: "string",
  });
}

async function requeueOnce() {
  let total = 0;

  for (const [queueName, exchange, routingKey] of bindings) {
    const messages = await getMessages(queueName);
    if (messages.length === 0) {
      continue;
    }

    let routed = 0;
    for (const message of messages) {
      const result = await publish(exchange, routingKey, message.payload);
      if (result.routed) {
        routed += 1;
      } else {
        console.error(`Message from ${queueName} was not routed to ${exchange}/${routingKey}`);
      }
    }

    total += routed;
    console.log(`Requeued ${routed}/${messages.length} from ${queueName} to ${exchange}/${routingKey}`);
  }

  if (total === 0) {
    console.log("No DLQ messages to requeue");
  }
}

async function main() {
  do {
    try {
      await requeueOnce();
    } catch (error) {
      console.error(`DLQ requeue failed: ${error.message}`);
    }

    if (WATCH) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_SECONDS * 1000));
    }
  } while (WATCH);
}

main();
