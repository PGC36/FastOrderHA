# Pruebas k6 de FastOrder HA

Estos scripts generan evidencia para rendimiento, concurrencia y resiliencia sobre la operacion critica:

```text
POST /api/orders
```

## Scripts disponibles

| Script | Uso |
|---|---|
| `order-write-test.js` | Prueba principal de escritura; por defecto envia 50,000 pedidos concurrentes. |
| `order-write-resilient-test.js` | Prueba resiliente con reintentos e idempotencia para caidas transitorias. |
| `run-50k-db-chaos.js` | Wrapper de caos: limpia datos, ejecuta la prueba resiliente, mata el primary de PostgreSQL y espera `Status: DONE`. |
| `sustained-write-test.js` | Prueba sostenida con tasa constante de pedidos. |

## Prueba principal 50k

```powershell
k6 run .\monitoring\k6\order-write-test.js
```

Valores por defecto:

- `TOTAL_ORDERS=50000`
- `VUS=200`
- `BASE_URL=http://[::1]:8080`
- `MAX_DURATION=2m`

Ejemplo ajustado:

```powershell
$env:TOTAL_ORDERS='10000'
$env:VUS='100'
$env:MAX_DURATION='1m'
k6 run .\monitoring\k6\order-write-test.js
```

## Prueba resiliente

```powershell
$env:TOTAL_ORDERS='50000'
$env:VUS='100'
$env:MAX_DURATION='30m'
$env:MAX_ATTEMPTS='150'
$env:RETRY_DELAY_SECONDS='2'
$env:REQUEST_TIMEOUT='5s'
$env:ITERATION_DELAY_SECONDS='0.2'
$env:RUN_ID='resilient-' + (Get-Date -Format 'yyyyMMddHHmmss')
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Esta prueba reutiliza la misma `idempotencyKey` por pedido cuando hay errores transitorios, evitando duplicados.

## Prueba 50k con caos de BD

```powershell
node .\monitoring\k6\run-50k-db-chaos.js
```

Prueba rapida sin tumbar la base:

```powershell
node .\monitoring\k6\run-50k-db-chaos.js --total-orders 10 --vus 2 --max-duration 1m --iteration-delay-seconds 0 --disable-chaos
```

Por defecto:

- limpia datos de la prueba anterior.
- prepara inventario para `50000` pedidos.
- ejecuta `order-write-resilient-test.js`.
- mata el primary de PostgreSQL en los segundos `5` y `140`.
- espera hasta que `monitoring/check-results.js` muestre `Status: DONE`.

## Prueba sostenida

```powershell
k6 run .\monitoring\k6\sustained-write-test.js
```

Ejemplo ajustado:

```powershell
$env:TOTAL_ORDERS='75000'
$env:RATE='250'
$env:DURATION='5m'
$env:PRE_ALLOCATED_VUS='300'
$env:MAX_VUS='1000'
k6 run .\monitoring\k6\sustained-write-test.js
```

## Validar resultado final

```powershell
node .\monitoring\check-results.js
```

El resultado esta completo cuando muestra:

- `Status: DONE`
- `Outbox pending: 0`
- `reserved=0`
- `Rabbit queues: empty`

## Logs generados

- `monitoring/k6/last-50k-result.txt`
- `monitoring/k6/last-resilient-result.txt`
- `monitoring/k6/last-50k-db-chaos-result.txt`
- `monitoring/k6/last-50k-db-chaos-events.txt`
- `monitoring/k6/last-50k-db-chaos-final.txt`
- `monitoring/k6/last-75k-sustained-result.txt`

La prueba resiliente muestra metricas propias en la salida de k6:

- `final_order_failed`
- `recovered_orders`
- `retry_attempts`
- `attempts_per_order`
