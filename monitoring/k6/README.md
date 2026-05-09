# FastOrder HA k6 Tests

These scripts generate the evidence required for the performance section.

## 50k write load

```powershell
$runId = "50k-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e TOTAL_ORDERS=50000 -e VUS=200 -e MAX_DURATION=30s -e RUN_ID=$runId grafana/k6:0.54.0 run /scripts/order-write-test.js
```

## Sustained concurrent writes

```powershell
$runId = "sustained-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e RATE=250 -e DURATION=5m -e RUN_ID=$runId grafana/k6:0.54.0 run /scripts/sustained-write-test.js
```

## Write spike

```powershell
$runId = "spike-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e RATE=5000 -e DURATION=10s -e RUN_ID=$runId grafana/k6:0.54.0 run /scripts/spike-write-test.js
```

## Read spike

```powershell
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e RATE=50000 -e DURATION=1s grafana/k6:0.54.0 run /scripts/one-second-spike.js
```

The k6 summaries report throughput, average latency, p95, p99, and error rate. CPU, memory, and RabbitMQ queue behavior are available in Grafana.
