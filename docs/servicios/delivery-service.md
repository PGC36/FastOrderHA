# delivery-service

## Responsabilidad

`delivery-service` gestiona la entrega de ordenes. En la Saga consume ordenes listas de cocina, crea el despacho, avanza el flujo de entrega por estados y publica el resultado final.

## Puerto

```text
8085
```

## Base de datos

Usa PostgreSQL general:

```text
fastorder_db
```

Tablas principales:

- `delivery_orders`
- `delivery_status_history`

Estados:

- `PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

## RabbitMQ

Consume:

| Cola | Evento |
|---|---|
| `delivery.kitchen-ready.queue` | `kitchen.ready` |

Publica:

| Evento | Significado |
|---|---|
| `delivery.completed` | La entrega termino correctamente; incluye `orderId`, `deliveryId`, `productId` y `quantity` |
| `delivery.failed` | La entrega fallo |
| `notification.created` | Se debe registrar una notificacion |

Configuracion relevante:

```text
DELIVERY_KITCHEN_READY_CONSUMERS=8
SPRING_RABBITMQ_LISTENER_SIMPLE_PREFETCH=20
SPRING_RABBITMQ_LISTENER_SIMPLE_CONCURRENCY=8
SPRING_RABBITMQ_LISTENER_SIMPLE_MAX_CONCURRENCY=16
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

## Comportamiento en la Saga

1. Recibe `kitchen.ready`.
2. Crea entrega idempotente por `orderId`.
3. Asigna repartidor.
4. Marca recogida.
5. Marca en transito.
6. Marca entregada o fallida.
7. Publica el evento correspondiente. Cuando publica `delivery.completed`, inventario lo usa para convertir la reserva en venta confirmada.

Si el servicio esta caido, RabbitMQ mantiene los mensajes en cola. Cuando vuelve a levantarse, los consume automaticamente.

Ademas de publicar eventos, sincroniza el estado derivado hacia `order-service`:

- `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT` -> `IN_DELIVERY`
- `DELIVERED` -> `COMPLETED`
- `FAILED` -> `DELIVERY_FAILED`
- `CANCELLED` -> `DELIVERY_CANCELLED`

## Regla de inventario

Si delivery falla despues de cocina, no se devuelve stock. En una operacion real, la comida ya fue preparada y el costo ya se consumio.

El reintento y abandono final lo decide `order-service`.

## Transiciones validas

Las transiciones permitidas en `delivery-service` son:

- `PENDING` -> `ASSIGNED`, `CANCELLED`
- `ASSIGNED` -> `PICKED_UP`, `CANCELLED`
- `PICKED_UP` -> `IN_TRANSIT`, `FAILED`
- `IN_TRANSIT` -> `DELIVERED`, `FAILED`
- `DELIVERED` -> final
- `FAILED` -> final
- `CANCELLED` -> final

Si se intenta una transicion invalida, el servicio responde error de negocio y no modifica la entrega.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `POST` | `/deliveries` | Crea una entrega |
| `GET` | `/deliveries/{id}` | Consulta entrega |
| `GET` | `/deliveries/by-order/{orderId}` | Consulta por orden |
| `PATCH` | `/deliveries/{id}/assign` | Asigna repartidor |
| `PATCH` | `/deliveries/{id}/pick-up` | Marca recogida |
| `PATCH` | `/deliveries/{id}/in-transit` | Marca en transito |
| `PATCH` | `/deliveries/{id}/deliver` | Marca entregada |
| `PATCH` | `/deliveries/{id}/fail` | Marca fallida |
| `PATCH` | `/deliveries/{id}/cancel` | Cancela entrega |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

Notas de uso:

- `POST /deliveries` es idempotente por `orderId` solo si los datos coinciden con una entrega ya existente.
- Si ya existe una entrega para el mismo `orderId` pero con datos distintos, responde conflicto.
- `PATCH /deliveries/{id}/assign` requiere `driverId`.
- `PATCH /deliveries/{id}/fail` requiere `reason`.
- `PATCH /deliveries/{id}/cancel` requiere `reason`.

## Observabilidad

Registra logs cuando:

- consume `kitchen.ready`.
- crea o reutiliza una entrega.
- cambia estados de delivery.
- sincroniza estado hacia `order-service`.
- publica `delivery.completed`.
- publica `delivery.failed`.
- publica notificaciones.
- ocurre un error.

## Docker

```bash
docker compose up --build -d delivery-service
docker compose logs -f delivery-service
```
