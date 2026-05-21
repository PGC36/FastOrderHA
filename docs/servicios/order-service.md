# order-service

## Responsabilidad

`order-service` es el centro del flujo de pedidos. Recibe ordenes por HTTP, aplica idempotencia, guarda la orden, publica el evento inicial con Outbox Pattern, consume eventos de otros servicios y coordina los reintentos de delivery.

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
6. `inventory-service`, `kitchen-service` y `delivery-service` actualizan el estado de la orden por eventos o por `PATCH /orders/{id}/status`.
7. Consume respuestas de inventario y delivery.
8. Si delivery falla, deja la orden en `DELIVERY_RETRY_PENDING` o la mueve a `DELIVERY_ABANDONED` cuando se agotan los reintentos.

## Idempotencia

`idempotencyKey` evita duplicar ordenes cuando el cliente reintenta una solicitud.

Si la misma clave llega otra vez, el servicio devuelve la orden existente y no crea otra fila.

## Outbox

`outbox_events` evita perder eventos entre la escritura de la orden y la publicacion a RabbitMQ. El publisher marca un evento como procesado solo cuando RabbitMQ confirma la publicacion y el mensaje no fue devuelto como no enrutable.

Si RabbitMQ no esta listo o aun no existe un binding, el evento queda pendiente para reintento.

Configuracion relevante:

```text
ORDER_PROCESSING_MODE=event
ORDER_OUTBOX_PUBLISHER_DELAY_MS=500
ORDER_OUTBOX_PUBLISHER_CONFIRM_TIMEOUT_MS=5000
ORDER_WORKFLOW_EVENT_CONSUMERS=8
SPRING_RABBITMQ_LISTENER_SIMPLE_PREFETCH=20
SPRING_RABBITMQ_LISTENER_SIMPLE_CONCURRENCY=8
SPRING_RABBITMQ_LISTENER_SIMPLE_MAX_CONCURRENCY=16
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

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

Tambien expone `PATCH /orders/{id}/status` para que otros servicios sincronicen estados derivados:

- `kitchen-service` envia `IN_KITCHEN`, `READY_FOR_DELIVERY` y `CANCELLED`
- `delivery-service` envia `IN_DELIVERY`, `COMPLETED`, `DELIVERY_FAILED` y `DELIVERY_CANCELLED`

## Estados de orden

| Estado | Uso |
|---|---|
| `PENDING` | Orden creada y en proceso asincrono |
| `IN_KITCHEN` | Cocina ya inicio preparacion |
| `CANCELLED` | Sin stock o fallo antes de preparacion; puede aplicar compensacion |
| `READY_FOR_DELIVERY` | Cocina termino y espera delivery |
| `IN_DELIVERY` | Delivery ya tomo la orden y esta en curso |
| `DELIVERY_FAILED` | Delivery reporto fallo tecnico o de negocio antes del siguiente reintento |
| `DELIVERY_RETRY_PENDING` | Orden pendiente de nuevo intento de delivery |
| `COMPLETED` | Delivery finalizado |
| `DELIVERY_CANCELLED` | Delivery fue cancelado por el flujo de entrega |
| `DELIVERY_ABANDONED` | Delivery fallo luego de agotar reintentos |

## Reintentos de delivery

Cuando delivery falla despues de que la orden ya fue preparada:

- la orden queda disponible para reintento.
- se incrementa `delivery_retry_count`.
- se actualiza `delivery_last_retry_at`.
- se conserva `delivery_failure_reason`.
- se reintenta automaticamente por tarea programada.
- si se agotan los reintentos, pasa a `DELIVERY_ABANDONED`.

En la implementacion actual, cuando el delivery se abandona definitivamente, `order-service` intenta liberar inventario llamando a `inventory-service/release`. Ademas, `inventory-service` tiene reconciliacion para reservas terminales en ordenes `CANCELLED` y `DELIVERY_ABANDONED`.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `POST` | `/orders` | Crea una orden |
| `GET` | `/orders` | Lista ordenes |
| `GET` | `/orders/{id}` | Consulta una orden |
| `GET` | `/orders/health-check` | Health funcional simple |
| `PATCH` | `/orders/{id}/status` | Actualiza estado de una orden |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

Notas de uso:

- `POST /orders` devuelve `201` cuando crea una orden nueva.
- si llega la misma `idempotencyKey` con los mismos datos, devuelve la orden existente con `200`.
- si llega la misma `idempotencyKey` con datos distintos, responde error de duplicidad.
- `PATCH /orders/{id}/status` se usa internamente para sincronizacion desde cocina y delivery.

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
- reintentos y abandono de delivery.
- errores controlados.

## Docker

```bash
docker compose up --build -d order-service
docker compose logs -f order-service
```
