# order-service

## Responsabilidad

`order-service` es el centro del flujo de pedidos. Recibe ordenes por HTTP, aplica idempotencia, guarda la orden, publica el evento inicial con Outbox Pattern y consume eventos de otros servicios para actualizar el estado final.

## Puerto

```text
8082
```

## Base de datos

Usa PostgreSQL general:

```text
fastorder_db
```

Tablas principales:

- `orders`
- `outbox_events`

## Flujo principal

1. Recibe `POST /orders`.
2. Valida `idempotencyKey`.
3. Crea la orden en estado `PENDING`.
4. Guarda `order.created` en `outbox_events`.
5. Un publisher procesa el outbox y publica a RabbitMQ con publisher confirms.
6. Consume respuestas de inventario y delivery.
7. Actualiza la orden a `CANCELLED`, `READY_FOR_DELIVERY`, `COMPLETED` o `ABANDONED`.

## Idempotencia

`idempotencyKey` evita duplicar ordenes cuando el cliente reintenta una solicitud.

Si la misma clave llega otra vez, el servicio devuelve la orden existente y no crea otra fila.

## Outbox

`outbox_events` evita perder eventos entre la escritura de la orden y la publicacion a RabbitMQ. El publisher marca un evento como procesado solo cuando RabbitMQ confirma la publicacion y el mensaje no fue devuelto como no enrutable.

Si RabbitMQ no esta listo o aun no existe un binding, el evento queda pendiente para reintento.

## RabbitMQ

Publica:

| Evento | Exchange | Routing key |
|---|---|---|
| `order.created` | `order.exchange` | `order.event` |

Consume:

| Cola | Evento esperado |
|---|---|
| `order.inventory-rejected.queue` | `inventory.rejected` |
| `order.delivery-completed.queue` | `delivery.completed` |
| `order.delivery-failed.queue` | `delivery.failed` |

## Estados de orden

| Estado | Uso |
|---|---|
| `PENDING` | Orden creada y en proceso asincrono |
| `CANCELLED` | Sin stock o fallo antes de preparacion; puede aplicar compensacion |
| `READY_FOR_DELIVERY` | Cocina termino y espera delivery |
| `COMPLETED` | Delivery finalizado |
| `ABANDONED` | Delivery fallo luego de agotar reintentos; no se devuelve inventario |

## Reintentos de delivery

Cuando delivery falla despues de que la orden ya fue preparada:

- la orden queda disponible para reintento.
- se incrementa `delivery_retry_count`.
- se actualiza `delivery_last_retry_at`.
- se conserva `delivery_failure_reason`.
- si se agotan los reintentos, pasa a `ABANDONED`.

Esta decision representa perdida operativa: la comida ya fue preparada, por eso no se compensa inventario.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `POST` | `/orders` | Crea una orden |
| `GET` | `/orders` | Lista ordenes |
| `GET` | `/orders/{id}` | Consulta una orden |
| `GET` | `/orders/health-check` | Health funcional simple |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

## Ejemplo

```json
{
  "productId": 1,
  "quantity": 1,
  "idempotencyKey": "pedido-cliente-001",
  "deliveryAddress": "Zona 1"
}
```

## Observabilidad

El servicio expone metricas con Actuator/Micrometer y logs de:

- creacion de ordenes.
- deteccion de idempotencia.
- publicacion del outbox.
- eventos consumidos desde RabbitMQ.
- cambios de estado.
- errores controlados.

## Docker

```bash
docker compose up --build -d order-service
docker compose logs -f order-service
```
