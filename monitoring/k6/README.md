# Pruebas k6 de FastOrder HA

Estos scripts generan evidencia para la seccion de rendimiento del proyecto. Las pruebas principales usan el API Gateway y ejecutan trafico real contra los microservicios.

## Carga minima 50k de escritura

```powershell
k6 run .\monitoring\k6\order-write-test.js
```

Este script envia `POST /api/orders` y crea ordenes reales. Por defecto corre contra `http://localhost:8080`, envia `50000` pedidos, usa `200` VUs y permite hasta `2m` para completar el envio. Para que todas las ordenes terminen `COMPLETED`, el inventario debe tener stock suficiente.

Si necesitas cambiar algun valor sin editar el archivo:

```powershell
$env:TOTAL_ORDERS='10000'
$env:VUS='100'
$env:MAX_DURATION='1m'
$env:BASE_URL='http://localhost:8080'
k6 run .\monitoring\k6\order-write-test.js
```

## Escritura concurrente sostenida

```powershell
k6 run .\monitoring\k6\sustained-write-test.js
```

## Pico de escritura

```powershell
k6 run .\monitoring\k6\spike-write-test.js
```

## Pico de lectura

```powershell
k6 run .\monitoring\k6\one-second-spike.js
```

## Lectura concurrente

```powershell
k6 run .\monitoring\k6\read-stress.js
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

## Ver resultado final de negocio

Despues de correr k6, puedes ver el resumen de ordenes, inventario, outbox y colas RabbitMQ con:

```powershell
node .\monitoring\check-results.js
```

Para verlo refrescandose mientras los workers terminan de procesar:

```powershell
node .\monitoring\check-results.js --watch
```

El resultado esta completo cuando el script muestra:

- `Status: DONE`
- `Outbox pending: 0`
- `reserved=0`
- `Rabbit queues: empty`
