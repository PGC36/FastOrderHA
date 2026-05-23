# Pruebas realizadas

## Objetivo

Este documento resume la evolucion de las pruebas ejecutadas sobre FastOrder HA, desde el flujo inicial con llamadas directas entre servicios hasta el flujo actual con workers, RabbitMQ, Redis, PostgreSQL HA con Patroni y recuperacion automatica.

La idea es dejar evidencia tecnica de:

- rendimiento bajo carga;
- consistencia de negocio;
- procesamiento asincrono;
- tolerancia a fallos;
- recuperacion despues de caos;
- problemas encontrados y ajustes aplicados.

## 1. Flujo inicial sin workers

### Enfoque probado

Al inicio, la creacion de pedidos se procesaba de forma mas directa entre servicios. El pedido dependia de llamadas sincronas hacia inventario, cocina, delivery y notificaciones.

### Hallazgos

- El flujo era simple de entender.
- La respuesta HTTP quedaba mas acoplada al tiempo de todos los servicios.
- Si un servicio intermedio fallaba, el pedido quedaba mas expuesto a errores parciales.
- Bajo carga alta, el endpoint de pedidos podia convertirse en cuello de botella.

### Decision

Se decidio mover el procesamiento del pedido a un flujo asincrono. La API recibe la orden, guarda el estado inicial y deja el trabajo pesado a workers/eventos.

## 2. Procesamiento asincrono con workers

### Enfoque probado

Se implemento un flujo donde `order-service` recibe la orden y la deja en estado `PENDING`. Luego los workers publican y consumen eventos para avanzar la saga:

```text
POST /api/orders
order-service
outbox_events
RabbitMQ
inventory-service
kitchen-service
delivery-service
notification-service
order-service
```

### Resultado

- El API pudo aceptar pedidos rapidamente.
- El trabajo pesado se proceso despues por eventos.
- Los pedidos pasaron por estados intermedios (`PENDING`, `IN_KITCHEN`, `READY_FOR_DELIVERY`, `IN_DELIVERY`) hasta `COMPLETED`.
- Se confirmo que no era necesario esperar a que cada pedido se entregara dentro de la respuesta HTTP.

### Decision

Mantener el flujo asincrono como modo principal:

```text
ORDER_PROCESSING_MODE=event
```

## 3. Outbox Pattern y RabbitMQ

### Enfoque probado

Se agrego `outbox_events` para evitar perder eventos cuando una orden se guarda en base de datos pero RabbitMQ no confirma la publicacion.

El evento se marca como procesado solo cuando RabbitMQ confirma el publish.

### Resultado esperado

```text
Outbox processed = total de ordenes aceptadas
Outbox pending = 0 al finalizar el drenaje
RabbitMQ sin mensajes acumulados
DLQ vacias
```

### Hallazgos

- El outbox permitio desacoplar escritura de ordenes y publicacion de eventos.
- Si los workers se atrasan, las ordenes quedan `PENDING`, pero no se pierden.
- El sistema puede seguir aceptando carga aunque la saga tarde varios minutos en terminar.

## 4. Idempotencia

### Enfoque probado

Cada pedido usa `idempotencyKey`. Si k6 o un cliente repite la misma solicitud, el sistema no debe crear pedidos duplicados.

### Validacion

El script `monitoring/check-results.js` muestra:

```text
Orders total
Idempotency keys unique
```

### Resultado esperado

```text
Orders total = Idempotency keys unique
```

En las pruebas de 50k, esta regla se cumplio.

## 5. Control de inventario

### Enfoque probado

Se valido que el sistema no sobrevendiera productos bajo alta concurrencia.

La tabla `inventory` mantiene:

```text
quantity
reserved
sold
```

La tabla `inventory_sales` registra ventas confirmadas y evita doble descuento por `order_id`.

### Prueba con stock suficiente

Inventario inicial:

```text
quantity=60000
reserved=0
sold=0
```

Resultado esperado despues de 50k:

```text
quantity=10000
reserved=0
sold=50000
inventory_sales=50000
```

### Prueba con stock insuficiente

Tambien se valido el caso donde entran mas pedidos que inventario disponible.

Resultado esperado:

- pedidos posibles terminan `COMPLETED`;
- pedidos sin inventario terminan `CANCELLED`;
- `reserved` vuelve a `0`;
- `sold` no supera el stock real;
- no hay sobreventa.

## 6. Evolucion de workers y procesamiento

### 6.1 Un solo worker interno en order-service

Primero se probo procesar pedidos con un worker interno dentro de `order-service`. En ese modelo, el endpoint `POST /api/orders` guardaba pedidos y el mismo servicio tomaba ordenes `PENDING` para ejecutar el flujo contra inventario, cocina, delivery y notificaciones.

Configuracion usada en esa etapa:

```text
ORDER_INTERNAL_WORKER_ENABLED=true
ORDER_PENDING_PROCESSOR_BATCH_SIZE=200
ORDER_PENDING_PROCESSOR_DELAY_MS=250
```

### Hallazgos

- El worker interno permitia sacar trabajo pesado del request HTTP.
- El pedido podia responder rapido como `PENDING`.
- Bajo carga grande, `order-service` quedaba con demasiada responsabilidad.
- Si `order-service` caia, se detenian tanto la entrada de pedidos como el procesamiento del flujo completo.
- La recuperacion dependia demasiado de que ese unico servicio volviera a levantar.

### Decision

Se decidio no dejar todo el flujo en un solo worker interno de `order-service`. Era mejor repartir el procesamiento entre servicios y usar eventos para desacoplar responsabilidades.

### 6.2 Outbox dentro de order-service

Despues se agrego el outbox para que `order-service` no procesara todo directamente. La orden queda guardada junto con un evento pendiente:

```text
orders
outbox_events
```

Prueba realizada:

```text
1. Crear pedido por POST /api/orders.
2. Verificar que orders tenga el pedido PENDING.
3. Verificar que outbox_events tenga order.created pendiente.
4. Esperar al publisher.
5. Confirmar que outbox_events.processed pase a true.
```

Resultado:

- No se perdia la orden aunque RabbitMQ tardara en recibir eventos.
- El estado `PENDING` se volvio normal mientras la saga drenaba.
- `check-results.js` permitio ver `Outbox processed` y `Outbox pending`.

### 6.3 RabbitMQ como flujo principal

Luego se movio el flujo principal a RabbitMQ. `order-service` publica `order.created` y los demas servicios avanzan la saga con eventos.

Flujo probado:

```text
order.created
inventory.reserved
kitchen.ready
delivery.completed
notification.created
```

Resultado:

- `inventory-service` consume pedidos y reserva stock.
- `kitchen-service` consume reservas y prepara la orden.
- `delivery-service` consume ordenes listas y completa entrega.
- `notification-service` consume notificaciones.
- `order-service` consume eventos de resultado y actualiza estado final.

### 6.4 Workers por servicio

Despues se ajusto la concurrencia de los consumidores para que no todo dependiera de un solo hilo/worker.

Variables usadas por servicio:

```text
INVENTORY_ORDER_CREATED_CONSUMERS=8
INVENTORY_DELIVERY_COMPLETED_CONSUMERS=8
KITCHEN_INVENTORY_RESERVED_CONSUMERS=8
DELIVERY_KITCHEN_READY_CONSUMERS=8
NOTIFICATION_CREATED_CONSUMERS=8
ORDER_WORKFLOW_EVENT_CONSUMERS=8
```

Tambien se uso prefetch/concurrencia de RabbitMQ:

```text
SPRING_RABBITMQ_LISTENER_SIMPLE_PREFETCH=20
SPRING_RABBITMQ_LISTENER_SIMPLE_CONCURRENCY=8
SPRING_RABBITMQ_LISTENER_SIMPLE_MAX_CONCURRENCY=16
```

### Resultado

- El sistema pudo aceptar 50k pedidos y procesarlos progresivamente.
- Los servicios drenaron colas en paralelo.
- El tiempo total de cierre dependio del drenaje de eventos, no del request HTTP.
- RabbitMQ permitio observar `ready` y `unacked` por cola.

### 6.5 Limpieza de scripts k6

Tambien se ajustaron los scripts k6 para que la prueba principal pudiera correrse con un comando simple:

```powershell
k6 run .\monitoring\k6\order-write-test.js
```

Se dejaron valores por defecto dentro del `.js`:

```text
TOTAL_ORDERS=50000
VUS=200
MAX_DURATION=2m
BASE_URL=http://localhost:8080
```

### 6.6 Script de resultados

Se agrego `monitoring/check-results.js` para no depender solo de lo que imprime k6. Este script valida el cierre real de negocio:

```text
orders por estado
outbox processed/pending
inventory quantity/reserved/sold
inventory_sales
notifications
RabbitMQ ready/unacked
```

Resultado esperado al terminar una prueba sana:

```text
Status: DONE
Outbox pending: 0
Rabbit queues: empty
reserved=0
```

## 7. Prueba k6 de 50,000 pedidos

### Comando

```powershell
k6 run .\monitoring\k6\order-write-test.js
```

### Resultado limpio sin caos

```text
50,000 / 50,000 pedidos aceptados
Errores HTTP: 0.00%
Checks: 100%
Throughput: 1449 req/s
Latencia promedio: 137.58 ms
p95: 306.32 ms
p99: 500.12 ms
Max: 2.07 s
```

### Resultado final de negocio

```text
Orders: COMPLETED: 50000
Outbox processed: 50000
Outbox pending: 0
Inventory: quantity=10000, reserved=0, sold=50000
Inventory sales: 50000
Notifications: 50000
Rabbit queues: empty
Status: DONE
```

### Interpretacion

k6 mide la entrada de pedidos. La saga asincrona termina despues. Por eso el resultado final se valida con:

```powershell
node .\monitoring\check-results.js
```

## 8. Redis como rate limiting

### Enfoque probado

Redis se integro en `api-gateway` para rate limiting.

Configuracion de demo:

```text
API_RATE_LIMIT_CAPACITY=100000
API_RATE_LIMIT_WINDOW_SECONDS=60
API_RATE_LIMIT_FAIL_OPEN=true
```

### Decision

Se dejo Redis como rate limiting, no como cache de negocio, porque el flujo principal es de escritura y no depende de muchos `GET`.

### Comportamiento esperado

- Si hay demasiadas peticiones, el gateway puede responder `429 Too Many Requests`.
- Si Redis se reinicia o falla, el gateway opera en modo `fail-open` para no tumbar la plataforma.

## 9. PostgreSQL HA con Patroni

### Enfoque probado

La base de datos paso de un solo PostgreSQL a:

```text
fastorder-db-0: Patroni/PostgreSQL
fastorder-db-1: Patroni/PostgreSQL
fastorder-db-2: Patroni/PostgreSQL
fastorder-db: HAProxy como endpoint unico
```

Los microservicios no apuntan directamente a un nodo. Siempre usan:

```text
jdbc:postgresql://fastorder-db:5432/fastorder_db
```

### Ajuste de conexiones

Durante la prueba de 50k, el proxy de base de datos quedo sensible a demasiadas conexiones potenciales. Se ajusto:

```text
POSTGRESQL_MAX_CONNECTIONS=200
PGPOOL_NUM_INIT_CHILDREN=120
PGPOOL_MAX_POOL=1
```

Tambien se limitaron los pools Hikari de los microservicios.

### Resultado

Despues del ajuste, el sistema completo proceso 50k pedidos y el endpoint `fastorder-db` respondio correctamente.

## 10. Caos de base de datos sin carga

### Prueba

Se mato el nodo primario manualmente:

```powershell
docker compose stop fastorder-db-1
```

Luego se valido:

```text
fastorder-db-0 se promovio a primario
HAProxy mantuvo el endpoint `fastorder-db`
La app pudo crear y completar pedidos
```

### Pedido de validacion

```text
Pedido creado: 50029
Estado final: COMPLETED
Outbox processed: 50001
Inventory reserved=0
RabbitMQ: colas vacias
```

## 11. Caos de base de datos durante 50k

### Primera prueba

Se intento matar el primario durante la misma ventana de entrada k6.

Resultado:

```text
50,000 iteraciones ejecutadas
47,791 aceptadas
2,209 errores HTTP durante failover
```

### Hallazgo

El sistema se recuperaba, pero durante la ventana exacta del failover algunos clientes recibian errores. Ademas, con reintentos cortos de RabbitMQ, algunos mensajes podian terminar en DLQ.

### Ajuste aplicado

Se aumentaron los reintentos de RabbitMQ:

```text
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

### Revalidacion: primario caido durante inserts

Despues de agregar recuperacion automatica se repitio el escenario, esta vez con 700 pedidos para no mezclar la prueba con falta de inventario. El nodo primario era `fastorder-db-1` y se mato durante la insercion de pedidos:

```powershell
$env:TOTAL_ORDERS='700'
$env:VUS='10'
$env:MAX_DURATION='2m'
k6 run .\monitoring\k6\order-write-test.js

docker kill fastorder-db-1
```

Resultado durante el failover:

```text
700 iteraciones ejecutadas
410 aceptadas
290 errores HTTP durante failover
http_req_failed: 41.42%
p95: 3.02 s
```

`db-recovery` recupero el nodo caido y el endpoint siguio disponible por medio de HAProxy:

```text
Recovering fastorder-db-1 because status=exited
Recovering fastorder-db because health=unhealthy
```

Los pedidos aceptados quedaron consistentes:

```text
Orders: COMPLETED: 59510
Outbox pending: 0
Inventory: quantity=490, reserved=0, sold=59510
Inventory sales: 59510
Notifications: 59510
Rabbit queues: empty
Status: DONE
```

Luego se reintento el mismo `RUN_ID` con las mismas 700 iteraciones. La idempotencia evito duplicar las 410 ya creadas y permitio crear las 290 que habian fallado:

```text
700 / 700 solicitudes correctas en el reintento
Errores HTTP: 0.00%
Orders: COMPLETED: 59800
Idempotency keys unique: 59800
Outbox pending: 0
Inventory: quantity=200, reserved=0, sold=59800
Rabbit queues: empty
Status: DONE
```

Conclusion: si el lider cae exactamente durante escrituras, puede existir una ventana corta de errores HTTP mientras Patroni completa la promocion y HAProxy cambia al nuevo lider. No hubo perdida ni duplicidad de los pedidos aceptados, y el reintento con la misma llave de idempotencia recupero las operaciones fallidas sin duplicarlas.

### Revalidacion automatica con script resiliente

Despues se agrego `monitoring/k6/order-write-resilient-test.js` para que el cliente k6 reintente automaticamente cada pedido que falle por la ventana de failover. El script usa la misma `idempotencyKey` por iteracion, por lo que un reintento no duplica una orden ya creada.

Tambien se agregaron dos mecanismos de recuperacion interna:

```text
dlq-recovery: reencola mensajes en DLQ hacia sus exchanges originales
InventoryReconciliationService: reconcilia reservas pendientes de ordenes COMPLETED, CANCELLED o DELIVERY_ABANDONED
```

Prueba ejecutada el 9 de mayo de 2026:

```powershell
$env:TOTAL_ORDERS='500'
$env:VUS='10'
$env:MAX_DURATION='10m'
$env:RETRY_DELAY_SECONDS='2'
$env:ITERATION_DELAY_SECONDS='0.2'
$env:REQUEST_TIMEOUT='5s'
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Durante la insercion se mato el primario:

```powershell
docker kill fastorder-db-1
```

Resultado k6:

```text
500 / 500 pedidos aceptados
final_order_failed: 0.00%
checks: 100%
recovered_orders: 10
retry_attempts: 160
attempts_per_order max: 17
http_req_failed: 24.24% en intentos transitorios
p95: 3.01 s
p99: 3.01 s
```

Resultado final de negocio:

```text
Outbox pending: 0
Inventory reserved: 0
Rabbit queues: empty
Status: DONE
```

Conclusion: con el script resiliente y los reconciliadores, la recuperacion de pedidos afectados por el failover ocurre dentro de la misma corrida de k6, sin repetir manualmente el `RUN_ID`.

## 12. 50k + caos durante procesamiento asincrono

### Enfoque

Se ejecuto k6 para meter 50k pedidos al gateway. Luego, mientras quedaban miles de eventos pendientes en outbox/workers, se mato el primario de PostgreSQL:

```powershell
docker kill fastorder-db-0
```

### Resultado k6

```text
50,000 / 50,000 pedidos aceptados
Errores HTTP: 0.00%
p95: 265.21 ms
p99: 391.55 ms
Throughput: 1630 req/s
```

### Resultado del failover

```text
fastorder-db-1 se promovio a primario
HAProxy apunto al lider activo
RabbitMQ no dejo mensajes en DLQ
Workers siguieron procesando despues del failover
```

### Resultado final

```text
Orders: COMPLETED: 50000
Outbox processed: 50000
Outbox pending: 0
Inventory: quantity=10000, reserved=0, sold=50000
Inventory sales: 50000
Notifications: 50000
Rabbit queues: empty
Status: DONE
```

## 13. Recuperacion automatica de nodos de BD

### Problema encontrado

En Docker Desktop, despues de usar `docker kill`, el contenedor matado podia quedar apagado aunque tuviera politica de reinicio. Esto dejaba el cluster funcionando con el nodo promovido, pero sin reincorporar automaticamente el nodo caido.

### Ajuste aplicado

Se agrego el servicio:

```text
db-recovery
```

Este contenedor usa Docker CLI y monta:

```text
/var/run/docker.sock
```

### Funcion

`db-recovery` revisa periodicamente:

```text
fastorder-db
fastorder-db-0
fastorder-db-1
```

Si detecta un nodo apagado, ejecuta:

```text
docker start <contenedor>
```

Si detecta que el proxy `fastorder-db` deja de responder, ejecuta:

```text
docker restart fastorder-db
```

### Validacion

Se mato el standby:

```powershell
docker kill fastorder-db-0
```

Resultado:

```text
Recovering fastorder-db-0 because status=exited
fastorder-db-0
```

Se mato el primario:

```powershell
docker kill fastorder-db-1
```

Resultado:

```text
Recovering fastorder-db-1 because status=exited
Recovering fastorder-db because health=unhealthy
El proxy `fastorder-db` volvio a responder
```

Despues se creo un pedido real y termino:

```text
Pedido: COMPLETED
Inventario reserved=0
Proxy `fastorder-db` operativo
```

## 14. Caos de microservicio critico

### Enfoque

Se probo matar `inventory-service`, que es critico para la regla de no sobreventa. La prueba se hizo con carga real mientras habia eventos pendientes para inventario.

### Comando de carga

```powershell
$env:TOTAL_ORDERS='3000'
$env:VUS='100'
$env:MAX_DURATION='1m'
k6 run .\monitoring\k6\order-write-test.js
```

### Accion destructiva

```powershell
docker kill fastorder-inventory-service
```

### Resultado k6

```text
3,000 / 3,000 pedidos aceptados
Errores HTTP: 0.00%
Checks: 100%
p95: 102.86 ms
p99: 149.97 ms
Throughput: 1831 req/s
```

### Hallazgo inicial

Al matar `inventory-service`, los mensajes quedaron protegidos en RabbitMQ:

```text
inventory.order-created.queue: ready=2900
DLQ: 0
```

Esto confirmo que no se perdian eventos, pero tambien mostro que el servicio debia recuperarse automaticamente para continuar el drenaje.

### Ajuste aplicado

Se extendio `db-recovery` para observar tambien microservicios principales:

```text
fastorder-api-gateway
fastorder-menu-service
fastorder-inventory-service
fastorder-order-service
fastorder-kitchen-service
fastorder-delivery-service
fastorder-notification-service
```

Cuando detecta un servicio apagado, ejecuta:

```text
docker start <contenedor>
```

### Resultado final

Despues de que `db-recovery` levanto `inventory-service`, RabbitMQ dreno la cola y el sistema quedo consistente:

```text
Orders: COMPLETED: 53001
Orders total: 53001
Idempotency keys unique: 53001
Outbox processed: 53001
Outbox pending: 0
Inventory: quantity=6999, reserved=0, sold=53001
Inventory sales: 53001
Notifications: 53001
Rabbit queues: empty
Status: DONE
```

### Caos secuencial de todos los servicios de aplicacion

Despues se valido que `db-recovery` pudiera recuperar todos los servicios de aplicacion uno por uno:

```text
fastorder-api-gateway
fastorder-menu-service
fastorder-order-service
fastorder-inventory-service
fastorder-kitchen-service
fastorder-delivery-service
fastorder-notification-service
```

Accion destructiva aplicada:

```powershell
docker kill <contenedor>
```

Resultado observado:

```text
Recovering fastorder-api-gateway because status=exited
Recovering fastorder-menu-service because status=exited
Recovering fastorder-order-service because status=exited
Recovering fastorder-inventory-service because status=exited
Recovering fastorder-kitchen-service because status=exited
Recovering fastorder-delivery-service because status=exited
Recovering fastorder-notification-service because status=exited
```

Validaciones posteriores:

```text
api-gateway /actuator/health: 200
menu-service via gateway: 200
order-service via gateway: 200
inventory-service via gateway: 200
kitchen-service via gateway: 200
delivery-service /actuator/health: 200
notification-service /actuator/health: 200
```

Nota: las rutas `GET /api/delivery` y `GET /api/notifications` no se usaron como validacion final porque esas operaciones no estan expuestas como lectura simple en los servicios actuales; para esos servicios se valido salud con Actuator y consistencia por la saga completa.

### Caos de todos los servicios durante 3000 pedidos

Tambien se ejecuto una prueba de carga de 3000 pedidos mientras se mataban los servicios de aplicacion. La carga se ejecuto con:

```powershell
$env:TOTAL_ORDERS='3000'
$env:VUS='100'
$env:MAX_DURATION='2m'
k6 run .\monitoring\k6\order-write-test.js
```

Durante la prueba se mataron estos contenedores:

```text
fastorder-inventory-service
fastorder-kitchen-service
fastorder-delivery-service
fastorder-notification-service
fastorder-order-service
fastorder-menu-service
fastorder-api-gateway
```

Resultado de k6:

```text
3000 / 3000 pedidos aceptados
Errores HTTP: 0.00%
Checks: 100%
p95: 122.05 ms
p99: 160.31 ms
Throughput: 1511 req/s
```

`db-recovery` detecto los contenedores apagados y los volvio a levantar:

```text
Recovering fastorder-inventory-service because status=exited
Recovering fastorder-kitchen-service because status=exited
Recovering fastorder-delivery-service because status=exited
Recovering fastorder-notification-service because status=exited
Recovering fastorder-order-service because status=exited
Recovering fastorder-menu-service because status=exited
Recovering fastorder-api-gateway because status=exited
```

Resultado final de consistencia:

```text
Orders: COMPLETED: 59100
Orders total: 59100
Idempotency keys unique: 59100
Outbox processed: 59100
Outbox pending: 0
Inventory: quantity=900, reserved=0, sold=59100
Inventory sales: 59100
Notifications: 59100
Rabbit queues: empty
Status: DONE
```

La prueba confirmo que, aunque los servicios se apaguen durante la carga, los pedidos aceptados siguen el flujo normal al recuperarse los contenedores.

## 15. Fix de estados terminales

### Problema encontrado

Durante carga alta, eventos tardios de delivery podian llegar despues de `delivery.completed`. Eso podia intentar mover un pedido ya `COMPLETED` hacia un estado de fallo/reintento.

### Ajuste aplicado

En `OrderService`, `COMPLETED` se trata como estado terminal para eventos tardios de cancelacion o fallo de delivery.

### Resultado

Los pedidos completados ya no se degradan por eventos tardios.

## 16. Prueba limpia con caida de BD durante insercion

### Escenario

Se limpio la base, se dejo inventario exacto para 1000 unidades y se ejecuto `order-write-resilient-test.js` mientras se mataba el nodo primary de PostgreSQL.

```powershell
$env:TOTAL_ORDERS='1000'
$env:VUS='10'
$env:MAX_DURATION='10m'
$env:RETRY_DELAY_SECONDS='2'
$env:ITERATION_DELAY_SECONDS='0.2'
$env:REQUEST_TIMEOUT='5s'
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Durante la prueba se ejecuto:

```powershell
docker kill fastorder-db-1
```

### Ajuste aplicado

Se agrego reconciliacion automatica en `notification-service` para crear la notificacion si un pedido ya quedo `COMPLETED` pero el evento se perdio durante la ventana de failover. Tambien se dejo `order_id` como unico en `notifications` para evitar duplicados.

### Resultado de k6

```text
1000 / 1000 pedidos aceptados
Recovered orders: 10
Retry attempts: 180
HTTP failures transitorios: 15.25%
Checks: 100%
p95: 3.01 s
p99: 3.01 s
```

### Resultado final de consistencia

```text
Orders: COMPLETED: 1000
Orders total: 1000
Idempotency keys unique: 1000
Outbox processed: 1000
Outbox pending: 0
Inventory: quantity=0, reserved=0, sold=1000
Inventory sales: 1000
Notifications: 1000
Rabbit queues: empty
Status: DONE
```

La prueba confirmo que el sistema puede recibir pedidos mientras cae el primary de PostgreSQL y recuperarse sin perder pedidos, sin duplicar idempotency keys y sin dejar colas pendientes.

## 17. Prueba definitiva: 50k con caida de BD y servicios

### Escenario

Se limpio la base, se dejo inventario exacto para 50,000 unidades y se ejecuto la carga resiliente mientras se mataban:

- `fastorder-db-1`, nodo primary de PostgreSQL.
- `fastorder-inventory-service`.
- `fastorder-delivery-service`.

Comando base:

```powershell
$env:TOTAL_ORDERS='50000'
$env:VUS='200'
$env:MAX_DURATION='15m'
$env:MAX_ATTEMPTS='80'
$env:RETRY_DELAY_SECONDS='2'
$env:REQUEST_TIMEOUT='5s'
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Caos ejecutado durante la insercion:

```powershell
docker kill fastorder-db-1
docker kill fastorder-inventory-service fastorder-delivery-service
```

### Hallazgo previo

En una primera corrida, 5 pedidos quedaron en estados terminales no exitosos porque algunos consumers convertian errores tecnicos de BD en fallos de negocio:

- `kitchen-service` publicaba `kitchen.failed` ante fallos transitorios.
- `delivery-service` publicaba `delivery.failed` ante fallos transitorios.

### Ajuste aplicado

Los consumers de `kitchen` y `delivery` ahora tratan errores tecnicos como reintentables. RabbitMQ conserva el mensaje y lo vuelve a entregar. Ademas, `delivery-service` retoma el flujo desde el estado existente del delivery para evitar duplicados o transiciones invalidas.

### Resultado de k6

```text
50000 / 50000 pedidos aceptados
Recovered orders: 200
Retry attempts: 3209
HTTP failures transitorios: 6.03%
Checks: 100%
p95: 3.00 s
p99: 3.01 s
```

### Recuperacion automatica observada

```text
Recovering fastorder-db-1 because status=exited
Recovering fastorder-inventory-service because status=exited
Recovering fastorder-delivery-service because status=exited
Recovering fastorder-db because health=unhealthy
```

### Resultado final de consistencia

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

La prueba confirma que el sistema soporta la carga de 50k, tolera la caida del primary de PostgreSQL y dos servicios criticos, recupera los contenedores automaticamente y mantiene consistencia final.

## 18. Prueba extrema: 50k con dos caidas de BD y cinco servicios

### Escenario

Se limpio la base, se dejo inventario exacto para 50,000 unidades y se ejecuto una carga resiliente de 50k pedidos mientras se inducian fallos escalonados:

- Caida del primary de PostgreSQL al inicio.
- Caida de `order-service`.
- Caida de `inventory-service`.
- Caida de `kitchen-service`.
- Segunda caida del primary de PostgreSQL aproximadamente a mitad de la prueba.
- Caida de `delivery-service`.
- Caida de `notification-service`.

Configuracion de k6:

```powershell
$env:TOTAL_ORDERS='50000'
$env:VUS='100'
$env:MAX_DURATION='30m'
$env:MAX_ATTEMPTS='150'
$env:RETRY_DELAY_SECONDS='2'
$env:REQUEST_TIMEOUT='5s'
$env:ITERATION_DELAY_SECONDS='0.2'
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Caos ejecutado durante la insercion:

```text
Killing primary fastorder-db-1
Killing order
Killing inventory
Killing kitchen
Killing primary fastorder-db-1
Killing delivery
Killing notification
```

### Resultado de k6

```text
50000 / 50000 pedidos aceptados
Recovered orders: 100
Retry attempts: 3505
HTTP failures transitorios: 6.55%
Checks: 100%
p95: 33.75 ms
p99: 1.03 s
Duracion aproximada: 3m16s
```

### Recuperacion automatica observada

```text
Recovering fastorder-db-1 because status=exited
Recovering fastorder-order-service because status=exited
Recovering fastorder-inventory-service because status=exited
Recovering fastorder-kitchen-service because status=exited
Recovering fastorder-db-1 because status=exited
Recovering fastorder-db because health=unhealthy
Recovering fastorder-delivery-service because status=exited
Recovering fastorder-notification-service because status=exited
```

### Drenado asincrono

Al terminar k6, los 50,000 pedidos ya habian sido aceptados, pero el flujo asincrono seguia procesando eventos pendientes. El sistema continuo avanzando solo:

```text
Primer corte:
Orders: COMPLETED: 11978 | IN_DELIVERY: 5 | IN_KITCHEN: 1 | PENDING: 38015 | READY_FOR_DELIVERY: 1
Outbox processed: 12010
Outbox pending: 37990
Rabbit queues: empty
Status: PROCESSING

Segundo corte:
Orders: COMPLETED: 35292 | IN_DELIVERY: 3 | IN_KITCHEN: 1 | PENDING: 14703 | READY_FOR_DELIVERY: 1
Outbox processed: 35315
Outbox pending: 14685
Rabbit queues: empty
Status: PROCESSING
```

### Resultado final de consistencia

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

Esta prueba confirma que el sistema puede aceptar 50k pedidos aun con caidas repetidas de la base de datos y caidas escalonadas de los cinco microservicios principales. La consistencia final se mantiene: no hubo sobreventa, no quedaron reservas colgadas, no hubo duplicidad de idempotency keys y no quedaron eventos pendientes.

## 19. Prueba de backup y restauracion manual

### Escenario

Se valido la estrategia de backup automatico y restauracion manual controlada.

Para simular perdida de datos se uso un backup generado automaticamente y luego se borro la tabla `notifications`.

Estado inicial:

```text
notifications=50000
orders=50000
```

Backup usado:

```text
fastorder_20260510042221.sql
```

Daño simulado:

```powershell
docker exec -e PGPASSWORD=fastorder123 fastorder-db psql -h 127.0.0.1 -U fastorder_user -d fastorder_db -c "truncate table notifications restart identity;"
```

### Restauracion

Para restaurar sin escrituras concurrentes se pausaron temporalmente los servicios de aplicacion y `db-recovery`. Luego se restauro con un contenedor temporal de PostgreSQL:

```powershell
docker run --rm --network fastorderha_fastorder-network -v ${PWD}/backups/postgres:/backups:ro -e PGPASSWORD=fastorder123 postgres:17-alpine psql -h fastorder-db -U fastorder_user -d fastorder_db -f /backups/fastorder_20260510042221.sql
```

### Resultado final

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

La prueba confirma que la restauracion manual recupera datos borrados y deja el sistema nuevamente consistente.

## Estado actual validado

El sistema ya demostro:

- 50k pedidos aceptados por el gateway.
- 50k pedidos procesados hasta `COMPLETED`.
- outbox sin pendientes al final.
- RabbitMQ sin acumulacion final.
- DLQ vacias en la prueba final.
- inventario sin sobreventa.
- idempotencia en pedidos.
- Redis en rate limiting.
- PostgreSQL HA con tres nodos Patroni.
- failover de BD.
- recuperacion automatica de nodos de BD con `db-recovery`.
- recuperacion automatica de microservicios con `db-recovery`.
- prueba de caos final con 50k, caida de BD y caida de `inventory-service`/`delivery-service`.
- prueba extrema con 50k, dos caidas de BD y caida escalonada de `order-service`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service`.
- backup automatico con `pg_dump`.
- restauracion manual validada despues de borrar datos de `notifications`.
- recuperacion automatica de intentos HTTP durante failover con `order-write-resilient-test.js`.
- reconciliacion automatica de reservas de inventario despues de fallos transitorios.
- reconciliacion automatica de notificaciones despues de failover.
- Endpoint `fastorder-db` recuperado automaticamente cuando un contenedor de BD se cae.

## Pendiente

- Evidencias visuales finales para el informe: k6, Grafana, RabbitMQ, Docker Compose, logs de failover, logs de backup y `check-results.js`.

