# Pruebas k6 de FastOrder HA

Estos scripts generan evidencia para la seccion de rendimiento del proyecto. Las pruebas principales usan el API Gateway y ejecutan trafico real contra los microservicios.

## Carga minima 50k de escritura

```powershell
$runId = "50k-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e TOTAL_ORDERS=50000 -e VUS=200 -e MAX_DURATION=30s -e RUN_ID=$runId grafana/k6:0.54.0 run /scripts/order-write-test.js
```

Este script envia `POST /api/orders` y crea ordenes reales. Para que la prueba termine completa, el inventario debe tener stock suficiente.

## Escritura concurrente sostenida

```powershell
$runId = "sustained-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e RATE=250 -e DURATION=5m -e RUN_ID=$runId grafana/k6:0.54.0 run /scripts/sustained-write-test.js
```

## Pico de escritura

```powershell
$runId = "spike-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e RATE=5000 -e DURATION=10s -e RUN_ID=$runId grafana/k6:0.54.0 run /scripts/spike-write-test.js
```

## Pico de lectura

```powershell
docker run --rm --network fastorderha_fastorder-network -v "${PWD}\monitoring\k6:/scripts" -e RATE=50000 -e DURATION=1s grafana/k6:0.54.0 run /scripts/one-second-spike.js
```

## Metricas

k6 reporta:

- throughput.
- latencia promedio.
- p95.
- p99.
- tasa de error.
- checks exitosos.

Grafana reporta:

- CPU y memoria por contenedor.
- JVM CPU y memoria por servicio.
- estado de colas RabbitMQ.
- mensajes Ready y Unacked.
- metricas HTTP de los servicios.

Dashboard local:

```text
http://localhost:3000
```
