# Guia de prueba de caos en base de datos

Esta guia explica como repetir la prueba donde se matan nodos de PostgreSQL mientras entran pedidos por k6, usando reintentos automaticos con idempotencia. La capa HA actual usa `Patroni + etcd + HAProxy`.

## Objetivo

Demostrar que el sistema:

- recupera automaticamente la infraestructura de base de datos;
- no pierde pedidos aceptados;
- no duplica pedidos al reintentar;
- mantiene inventario, ventas, notificaciones, outbox y colas consistentes.

## Idea principal

Cuando cae el nodo primario de PostgreSQL durante escrituras, puede existir una ventana corta donde algunas peticiones HTTP fallen. Eso es normal durante el failover.

La forma correcta de recuperarlas es reintentar con la misma `idempotencyKey`. El script resiliente lo hace automaticamente. La opcion manual consiste en repetir la carga usando el mismo `RUN_ID`, porque el script k6 genera la `idempotencyKey` con ese valor:

```text
k6-real-<RUN_ID>-<numero_de_iteracion>
```

Si una orden ya fue creada, el reintento la reconoce por su llave de idempotencia y no la duplica. Si la orden fallo antes de crearse, el reintento la crea.

## 1. Entrar al proyecto

Ejecutar los comandos desde la raiz del proyecto:

```powershell
cd C:\ProyectoBDII\FastOrderHA
```

## 2. Verificar estado inicial

Antes de iniciar, validar que todos los contenedores esten arriba:

```powershell
docker ps
```

Tambien validar que el sistema este consistente:

```powershell
node .\monitoring\check-results.js
```

Resultado esperado antes de iniciar:

```text
Outbox pending: 0
Rabbit queues: empty
Status: DONE
```

## 3. Identificar el nodo primario

Consultar los tres nodos:

```powershell
docker exec -e PGPASSWORD=fastorder123 fastorder-db-0 psql -U fastorder_user -d fastorder_db -tAc "select pg_is_in_recovery();"
docker exec -e PGPASSWORD=fastorder123 fastorder-db-1 psql -U fastorder_user -d fastorder_db -tAc "select pg_is_in_recovery();"
docker exec -e PGPASSWORD=fastorder123 fastorder-db-2 psql -U fastorder_user -d fastorder_db -tAc "select pg_is_in_recovery();"
```

Interpretacion:

```text
f = primario
t = standby / replica
```

Ejemplo:

```text
fastorder-db-0 -> t
fastorder-db-1 -> f
```

En ese caso, el primario es `fastorder-db-1`.

## 4. Opcion recomendada: k6 resiliente con reintentos automaticos

Para la demo de caos se recomienda usar el script resiliente. Este script reintenta automaticamente cada pedido que falle por un error transitorio, usando la misma `idempotencyKey`.

```powershell
$env:TOTAL_ORDERS='700'
$env:VUS='10'
$env:MAX_DURATION='10m'
$env:MAX_ATTEMPTS='60'
$env:RETRY_DELAY_SECONDS='2'
$env:ITERATION_DELAY_SECONDS='0.2'
$env:RUN_ID='db-chaos-demo-001'

k6 run .\monitoring\k6\order-write-resilient-test.js
```

Mientras este comando corre, ejecutar la accion destructiva del paso 5 en otra terminal.

Metricas importantes del script:

```text
final_order_failed: pedidos que fallaron aun despues de reintentos
recovered_orders: pedidos recuperados por reintento
retry_attempts: reintentos ejecutados
attempts_per_order: intentos usados por pedido
```

El resultado ideal es:

```text
final_order_failed: 0%
checks: 100%
recovered_orders: mayor que 0 si hubo failover durante la prueba
```

Resultado validado en la prueba del 9 de mayo de 2026:

```text
500 / 500 pedidos aceptados
final_order_failed: 0.00%
recovered_orders: 10
retry_attempts: 160
attempts_per_order max: 17
http_req_failed: 24.24% en intentos transitorios
```

Despues del drenaje asincrono:

```text
Outbox pending: 0
Inventory reserved: 0
Rabbit queues: empty
Status: DONE
```

## 4.1. Opcion manual: primera corrida con k6 normal

Usar un `RUN_ID` fijo. No usar uno automatico si se quiere repetir despues.

Ejemplo con 700 pedidos:

```powershell
$env:TOTAL_ORDERS='700'
$env:VUS='10'
$env:MAX_DURATION='2m'
$env:RUN_ID='db-chaos-demo-001'

k6 run .\monitoring\k6\order-write-test.js
```

## 5. Matar el primario durante la carga

Mientras k6 sigue corriendo, abrir otra terminal en la misma carpeta:

```powershell
cd C:\ProyectoBDII\FastOrderHA
```

Matar el nodo primario identificado en el paso 3:

```powershell
docker kill fastorder-db-1
```

Si el primario fuera `fastorder-db-0`, usar:

```powershell
docker kill fastorder-db-0
```

## 6. Esperar recuperacion automatica

El contenedor `fastorder-db-recovery` debe recuperar el nodo caido. Patroni elige un nuevo lider y `HAProxy` mantiene el endpoint `fastorder-db`.

Ver estado:

```powershell
docker ps
```

Ver logs de recuperacion:

```powershell
docker logs --tail 80 fastorder-db-recovery
```

Mensajes esperados:

```text
Recovering fastorder-db-1 because status=exited
```

## 7. Revisar resultado despues del failover

Cuando k6 termine y los contenedores vuelvan a estar arriba:

```powershell
node .\monitoring\check-results.js
```

Puede pasar que k6 muestre errores HTTP durante esta primera corrida, por ejemplo:

```text
700 iteraciones ejecutadas
410 aceptadas
290 errores HTTP durante failover
```

Eso significa que algunas peticiones llegaron justo durante la ventana de failover. Lo importante es que las que si fueron aceptadas queden consistentes:

```text
Outbox pending: 0
Rabbit queues: empty
Status: DONE
```

## 8. Reintento manual con el mismo RUN_ID

Este paso solo es necesario si se uso `order-write-test.js`. Si se uso `order-write-resilient-test.js` con suficientes intentos, el reintento ya ocurre automaticamente dentro del mismo comando.

Para recuperar manualmente las peticiones que fallaron, ejecutar k6 otra vez con el mismo `RUN_ID`.

Se puede subir un poco `VUS` porque ya no se esta matando la base de datos:

```powershell
$env:TOTAL_ORDERS='700'
$env:VUS='20'
$env:MAX_DURATION='2m'
$env:RUN_ID='db-chaos-demo-001'

k6 run .\monitoring\k6\order-write-test.js
```

Clave: el `RUN_ID` debe ser exactamente el mismo que en la primera corrida.

## 9. Validar consistencia final

Despues del reintento:

```powershell
node .\monitoring\check-results.js
```

Resultado esperado:

```text
Outbox pending: 0
Rabbit queues: empty
Status: DONE
```

Tambien se debe verificar:

```text
Orders total = cantidad final esperada
Idempotency keys unique = Orders total
Inventory reserved = 0
Inventory sales = pedidos completados
Notifications = pedidos completados
```

## 10. Que explicar en la demo

La explicacion recomendada:

```text
Durante la caida del primario puede haber una ventana corta de errores HTTP porque Patroni y HAProxy estan haciendo failover.

El sistema no pierde ni duplica los pedidos que ya fueron aceptados. Para las peticiones que fallan durante esa ventana, el cliente reintenta con la misma llave de idempotencia.

Al reintentar, las operaciones ya creadas se reconocen como existentes y las que no alcanzaron a guardarse se crean normalmente. Por eso al final no hay duplicidad, no queda inventario reservado y las colas quedan vacias.
```

## 11. Evidencias recomendadas

Guardar capturas de:

- salida de k6 de la primera corrida;
- comando `docker kill` del primario;
- logs de `fastorder-db-recovery`;
- `docker ps` mostrando `fastorder-db` arriba y los nodos Patroni recuperados;
- salida de `node .\monitoring\check-results.js` despues del failover;
- salida de k6 del reintento;
- salida final de `check-results.js` con `Status: DONE`.

## 12. Nota importante

Esta prueba valida recuperacion e idempotencia ante failover de base de datos. No significa que ninguna peticion pueda fallar durante la caida exacta del primario.

Lo que se garantiza es:

- las operaciones aceptadas no se pierden;
- las operaciones aceptadas no se duplican;
- las operaciones fallidas pueden reintentarse con la misma llave;
- el sistema vuelve a un estado consistente.
