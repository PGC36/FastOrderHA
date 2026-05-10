const { execFileSync } = require("node:child_process");

const DB_CONTAINER = process.env.DB_CONTAINER || "fastorder-db";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const RABBIT_CONTAINER = process.env.RABBIT_CONTAINER || "fastorder-rabbitmq";
const DB_USER = process.env.DB_USER || "fastorder_user";
const DB_NAME = process.env.DB_NAME || "fastorder_db";
const DB_PASSWORD = process.env.DB_PASSWORD || "fastorder123";
const WATCH = process.argv.includes("--watch");
const INTERVAL_SECONDS = Number(process.env.INTERVAL_SECONDS || 10);

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
  }).trim();
}

function psql(sql) {
  return run("docker", [
    "exec",
    "-e",
    `PGPASSWORD=${DB_PASSWORD}`,
    DB_CONTAINER,
    "psql",
    "-h",
    DB_HOST,
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
    "-At",
    "-F",
    "|",
    "-c",
    sql,
  ]);
}

function rows(output) {
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|"));
}

function number(value) {
  return Number(value || 0);
}

function getOrdersByStatus() {
  return Object.fromEntries(
    rows(psql("select status, count(*) from orders group by status order by status;"))
      .map(([status, count]) => [status, number(count)])
  );
}

function getSingleCount(sql) {
  const result = rows(psql(sql));
  return result.length ? number(result[0][0]) : 0;
}

function getOutbox() {
  return Object.fromEntries(
    rows(psql("select processed::text, count(*) from outbox_events group by processed order by processed;"))
      .map(([processed, count]) => [processed === "t" || processed === "true" ? "processed" : "pending", number(count)])
  );
}

function getInventory() {
  return rows(psql("select product_id, quantity, reserved, sold from inventory order by product_id;"))
    .map(([productId, quantity, reserved, sold]) => ({
      productId,
      quantity: number(quantity),
      reserved: number(reserved),
      sold: number(sold),
    }));
}

function getRabbitQueues() {
  const output = run("docker", [
    "exec",
    RABBIT_CONTAINER,
    "rabbitmqctl",
    "list_queues",
    "name",
    "messages_ready",
    "messages_unacknowledged",
  ]);

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Timeout:") && !line.startsWith("Listing") && !line.startsWith("name"))
    .map((line) => {
      const [name, ready, unacked] = line.split(/\s+/);
      return {
        name,
        ready: number(ready),
        unacked: number(unacked),
      };
    });
}

function formatStatus(statuses) {
  const entries = Object.entries(statuses);
  return entries.length ? entries.map(([status, count]) => `${status}: ${count}`).join(" | ") : "sin ordenes";
}

function printReport() {
  const statuses = getOrdersByStatus();
  const outbox = getOutbox();
  const inventory = getInventory();
  const inventorySales = getSingleCount("select count(*) from inventory_sales;");
  const notifications = getSingleCount("select count(*) from notifications;");
  const orderTotals = rows(psql("select count(*), count(distinct idempotency_key) from orders;"))[0] || ["0", "0"];
  const queues = getRabbitQueues();
  const activeQueues = queues.filter((queue) => queue.ready > 0 || queue.unacked > 0);
  const totalOrders = number(orderTotals[0]);
  const uniqueKeys = number(orderTotals[1]);
  const pendingOutbox = outbox.pending || 0;
  const processedOutbox = outbox.processed || 0;

  console.clear();
  console.log(`FastOrder HA results - ${new Date().toLocaleString()}`);
  console.log("");
  console.log(`Orders: ${formatStatus(statuses)}`);
  console.log(`Orders total: ${totalOrders}`);
  console.log(`Idempotency keys unique: ${uniqueKeys}`);
  console.log("");
  console.log(`Outbox processed: ${processedOutbox}`);
  console.log(`Outbox pending: ${pendingOutbox}`);
  console.log("");
  console.log("Inventory:");
  inventory.forEach((item) => {
    console.log(
      `  product ${item.productId}: quantity=${item.quantity}, reserved=${item.reserved}, sold=${item.sold}`
    );
  });
  console.log(`Inventory sales: ${inventorySales}`);
  console.log(`Notifications: ${notifications}`);
  console.log("");

  if (activeQueues.length === 0) {
    console.log("Rabbit queues: empty");
  } else {
    console.log("Rabbit queues with messages:");
    activeQueues.forEach((queue) => {
      console.log(`  ${queue.name}: ready=${queue.ready}, unacked=${queue.unacked}`);
    });
  }

  const pendingOrders = Object.entries(statuses)
    .filter(([status]) => !["COMPLETED", "CANCELLED", "ABANDONED", "DELIVERY_ABANDONED"].includes(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const reserved = inventory.reduce((sum, item) => sum + item.reserved, 0);
  const activeQueueMessages = activeQueues.reduce((sum, queue) => sum + queue.ready + queue.unacked, 0);
  const done = pendingOrders === 0 && pendingOutbox === 0 && reserved === 0 && activeQueueMessages === 0;

  console.log("");
  console.log(done ? "Status: DONE" : "Status: PROCESSING");
}

function main() {
  printReport();

  if (WATCH) {
    setInterval(printReport, INTERVAL_SECONDS * 1000);
  }
}

main();
