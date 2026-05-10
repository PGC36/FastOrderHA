# Pruebas de carga con k6

## Objetivo

Validar los requisitos de rendimiento del proyecto:

- carga minima de 50,000 peticiones.
- carga concurrente sostenida.
- picos de trafico.
- throughput.
- latencia promedio.
- latencia p95 y p99.
- tasa de error.
- CPU y memoria mediante Grafana.

Tambien se validan pruebas de caos matando contenedores de microservicios y nodos de PostgreSQL durante la carga.

## Scripts disponibles

| Script | Tipo | Descripcion |
|---|---|---|
| `monitoring/k6/order-write-test.js` | Escritura 50k | Crea ordenes reales por `POST /api/orders` |
| `monitoring/k6/order-write-resilient-test.js` | Escritura resiliente | Crea ordenes con reintentos por pedido usando la misma `idempotencyKey` |
| `monitoring/k6/sustained-write-test.js` | Escritura sostenida | Mantiene una tasa constante de ordenes |
| `monitoring/k6/spike-write-test.js` | Pico de escritura | Lanza un pico fuerte de ordenes por pocos segundos |
| `monitoring/k6/read-stress.js` | Lectura | Consulta endpoints del gateway |
| `monitoring/k6/one-second-spike.js` | Pico de lectura | Intenta un pico extremo de lecturas |

## Prueba 50k de escritura

```powershell
k6 run .\monitoring\k6\order-write-test.js
```

## Preparar una prueba limpia

Todos los comandos se ejecutan desde la raiz del proyecto:

```powershell
cd C:\ProyectoBDII\FastOrderHA
```

Levantar el entorno:

```powershell
docker compose up -d
```

Preparar inventario y limpiar datos para 1,000 pedidos:

```powershell
docker exec -e PGPASSWORD=fastorder123 fastorder-db psql -h 127.0.0.1 -U fastorder_user -d fastorder_db -c "truncate table delivery_status_history, delivery_orders, kitchen_orders, notifications, outbox_events, inventory_sales, inventory_reservations, orders restart identity cascade; update inventory set quantity = 1000, reserved = 0, sold = 0 where product_id = 1;"
```

Preparar inventario y limpiar datos para 50,000 pedidos:

```powershell
docker exec -e PGPASSWORD=fastorder123 fastorder-db psql -h 127.0.0.1 -U fastorder_user -d fastorder_db -c "truncate table delivery_status_history, delivery_orders, kitchen_orders, notifications, outbox_events, inventory_sales, inventory_reservations, orders restart identity cascade; update inventory set quantity = 50000, reserved = 0, sold = 0 where product_id = 1;"
```

## Prueba resiliente con reintentos

Esta prueba es para caos de base de datos o caidas transitorias. Cada pedido usa una `idempotencyKey` estable y, si recibe un error transitorio, reintenta la misma orden hasta agotar `MAX_ATTEMPTS`.

```powershell
$env:TOTAL_ORDERS='700'
$env:VUS='10'
$env:MAX_DURATION='10m'
$env:MAX_ATTEMPTS='60'
$env:RETRY_DELAY_SECONDS='2'
$env:RUN_ID='db-chaos-demo-001'

k6 run .\monitoring\k6\order-write-resilient-test.js
```

Errores transitorios que se reintentan:

- `408`
- `429`
- `500`
- `502`
- `503`
- `504`
- errores de conexion o timeout

Metricas propias del script:

- `final_order_failed`: pedidos que fallaron aun despues de reintentos.
- `recovered_orders`: pedidos que fallaron al menos una vez y luego fueron aceptados.
- `retry_attempts`: cantidad total de reintentos ejecutados.
- `attempts_per_order`: intentos usados por pedido.

Para que el kill de base de datos ocurra mientras todavia entran pedidos, se puede desacelerar cada iteracion:

```powershell
$env:ITERATION_DELAY_SECONDS='0.2'
```

## Prueba resiliente 50k recomendada

Esta es la configuracion usada para la prueba fuerte con recuperacion automatica:

```powershell
$env:TOTAL_ORDERS='50000'
$env:VUS='100'
$env:MAX_DURATION='30m'
$env:MAX_ATTEMPTS='150'
$env:RETRY_DELAY_SECONDS='2'
$env:REQUEST_TIMEOUT='5s'
$env:ITERATION_DELAY_SECONDS='0.2'
$env:RUN_ID='demo-' + (Get-Date -Format 'yyyyMMddHHmmss')
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Al terminar k6, validar si el flujo asincrono ya completo:

```powershell
node .\monitoring\check-results.js
```

Si aparece `Status: PROCESSING`, esperar y volver a revisar:

```powershell
Start-Sleep -Seconds 300
node .\monitoring\check-results.js
```

Resultado esperado con inventario exacto:

```text
Orders: COMPLETED: 50000
Orders total: 50000
Idempotency keys unique: 50000
Outbox processed: 50000
Outbox pending: 0
Inventory: quantity=0, reserved=0, sold=50000
Inventory sales: 50000
Notifications: 50000
Rabbit queues: empty
Status: DONE
```

## Prueba de caos matando servicios

En una terminal ejecutar k6:

```powershell
$env:TOTAL_ORDERS='3000'
$env:VUS='100'
$env:MAX_DURATION='10m'
$env:MAX_ATTEMPTS='80'
$env:RETRY_DELAY_SECONDS='2'
$env:REQUEST_TIMEOUT='5s'
$env:RUN_ID='service-chaos-' + (Get-Date -Format 'yyyyMMddHHmmss')
k6 run .\monitoring\k6\order-write-resilient-test.js
```

En otra terminal, mientras k6 esta corriendo, matar uno o varios servicios:

```powershell
docker kill fastorder-order-service
docker kill fastorder-inventory-service
docker kill fastorder-kitchen-service
docker kill fastorder-delivery-service
docker kill fastorder-notification-service
```

Verificar que `fastorder-db-recovery` los levante automaticamente:

```powershell
docker logs fastorder-db-recovery --since 10m
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Prueba de caos matando PostgreSQL primary

Identificar que nodo es primary:

```powershell
docker exec -e PGPASSWORD=fastorder123 fastorder-db-0 psql -U fastorder_user -d fastorder_db -tAc "select case when pg_is_in_recovery() then 'replica' else 'primary' end"
docker exec -e PGPASSWORD=fastorder123 fastorder-db-1 psql -U fastorder_user -d fastorder_db -tAc "select case when pg_is_in_recovery() then 'replica' else 'primary' end"
```

Matar el nodo que responda `primary`:

```powershell
docker kill fastorder-db-1
```

Si el primary fuera `fastorder-db-0`, usar:

```powershell
docker kill fastorder-db-0
```

Verificar recuperacion:

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
docker logs fastorder-db-recovery --since 10m
node .\monitoring\check-results.js
```

## Prueba extrema 50k con BD y cinco servicios

Terminal 1: ejecutar k6 resiliente:

```powershell
$env:TOTAL_ORDERS='50000'
$env:VUS='100'
$env:MAX_DURATION='30m'
$env:MAX_ATTEMPTS='150'
$env:RETRY_DELAY_SECONDS='2'
$env:REQUEST_TIMEOUT='5s'
$env:ITERATION_DELAY_SECONDS='0.2'
$env:RUN_ID='final-chaos-' + (Get-Date -Format 'yyyyMMddHHmmss')
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Terminal 2: ejecutar caos escalonado:

```powershell
function Kill-PrimaryDb {
  $primary = $null
  foreach ($node in @('fastorder-db-0','fastorder-db-1')) {
    try {
      $role = docker exec -e PGPASSWORD=fastorder123 $node psql -U fastorder_user -d fastorder_db -tAc "select case when pg_is_in_recovery() then 'replica' else 'primary' end" 2>$null
      if (($role -join '').Trim() -eq 'primary') { $primary = $node }
    } catch {}
  }
  if ($primary) {
    Write-Host "Killing primary $primary"
    docker kill $primary
  } else {
    Write-Host "No primary detected"
  }
}

Start-Sleep -Seconds 3
Kill-PrimaryDb
Start-Sleep -Seconds 12
docker kill fastorder-order-service
Start-Sleep -Seconds 15
docker kill fastorder-inventory-service
Start-Sleep -Seconds 15
docker kill fastorder-kitchen-service
Start-Sleep -Seconds 12
Kill-PrimaryDb
Start-Sleep -Seconds 12
docker kill fastorder-delivery-service
Start-Sleep -Seconds 15
docker kill fastorder-notification-service
```

Validar resultado final:

```powershell
node .\monitoring\check-results.js
docker exec fastorder-rabbitmq rabbitmqctl list_queues name messages messages_ready messages_unacknowledged
docker logs fastorder-db-recovery --since 15m
```

## Carga sostenida

```powershell
k6 run .\monitoring\k6\sustained-write-test.js
```

## Pico de escritura

```powershell
k6 run .\monitoring\k6\spike-write-test.js
```

## Ver resultado de negocio

```powershell
node .\monitoring\check-results.js
```

Para ver el drenaje asincrono en vivo:

```powershell
node .\monitoring\check-results.js --watch
```

## Resultado de referencia historico

Prueba completa registrada durante la evolucion del proyecto con stock suficiente:

| Metrica | Resultado |
|---|---:|
| Ordenes enviadas | `50,000` |
| Metodo | `POST /api/orders` |
| Duracion de envio k6 | `26.0 s` |
| Throughput aproximado | `1,924 req/s` |
| Tasa de error HTTP | `0%` |
| Checks k6 | `100%` |
| Latencia promedio | `103.6 ms` |
| Latencia p95 | `257.15 ms` |
| Latencia p99 | `366.16 ms` |
| Latencia maxima | `1.65 s` |
| Ordenes finales `COMPLETED` | `50,010` acumuladas |
| Inventario `reserved` | `0` |
| Inventario `sold` | `50,010` |
| Notificaciones finales | `50,010` |
| Tiempo hasta completar la saga | aprox. `9 min 30 s` |

## Resultado con inventario insuficiente

Tambien se valido el caso donde entran 50,000 solicitudes adicionales sin stock suficiente. El sistema acepto la carga, no sobrevendio y cancelo lo que no podia cumplir.

| Metrica | Resultado |
|---|---:|
| Ordenes totales acumuladas | `100,010` |
| Ordenes finales `COMPLETED` | `60,000` |
| Ordenes finales `CANCELLED` | `40,010` |
| Outbox procesado | `100,010` |
| Inventario `quantity` | `0` |
| Inventario `reserved` | `0` |
| Inventario `sold` | `60,000` |
| `inventory_sales` | `60,000` |
| RabbitMQ Ready/Unacked | `0` |

## Como validar que todo completo

```powershell
node .\monitoring\check-results.js
```

El resultado esperado para una prueba 50k con stock suficiente es:

- `orders`: 50,000 en `COMPLETED`.
- `notifications`: 50,000 registros.
- `inventory.reserved`: 0.
- `inventory.sold`: 50,000.
- `outbox.pending`: 0.
- RabbitMQ sin acumulacion permanente en las colas principales.

## Grafana

Las metricas operativas se revisan en:

```text
http://localhost:3000
```

Paneles importantes:

- CPU por contenedor desde cAdvisor.
- Memoria por contenedor desde cAdvisor.
- Estado de targets Prometheus.
- Colas RabbitMQ por nombre.
- Mensajes Ready/Unacked.
- JVM CPU y memoria por servicio Spring.
- Latencia y conteo HTTP de servicios.

## Interpretacion actual

El sistema cumple la prueba minima de 50,000 peticiones de escritura sin errores HTTP y sin perdida de ordenes. La parte que mas tarda no es aceptar la orden, sino procesar toda la saga hasta `COMPLETED`.

Para mejorar aun mas el tiempo total de cierre de ordenes, los siguientes pasos opcionales serian:

- tuning de base de datos y RabbitMQ bajo carga real.

Redis ya esta integrado en el API Gateway para rate limiting. El limite por defecto permite esta prueba de 50,000 peticiones; si se baja `API_RATE_LIMIT_CAPACITY`, k6 puede recibir respuestas `429` por exceso de trafico.
