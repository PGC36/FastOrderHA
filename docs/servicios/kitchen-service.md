# kitchen-service

## Responsabilidad

`kitchen-service` gestiona la preparacion de ordenes. Dentro de la Saga consume eventos de inventario reservado, crea la orden de cocina y la marca lista para entrega.

## Puerto

```text
8084
```

## Base de datos

Usa PostgreSQL general:

```text
fastorder_db
```

Tabla principal:

- `kitchen_orders`

Estados:

- `PENDING`
- `PREPARING`
- `READY`
- `CANCELLED`

## RabbitMQ

Consume:

| Cola | Evento |
|---|---|
| `kitchen.inventory-reserved.queue` | `inventory.reserved` |

Publica:

| Evento | Significado |
|---|---|
| `kitchen.ready` | La orden ya fue preparada y puede pasar a delivery |

Configuracion relevante:

```text
KITCHEN_INVENTORY_RESERVED_CONSUMERS=8
SPRING_RABBITMQ_LISTENER_SIMPLE_PREFETCH=20
SPRING_RABBITMQ_LISTENER_SIMPLE_CONCURRENCY=8
SPRING_RABBITMQ_LISTENER_SIMPLE_MAX_CONCURRENCY=16
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

## Comportamiento en la Saga

1. Recibe `inventory.reserved`.
2. Crea una orden de cocina de forma idempotente por `orderId`.
3. Cambia la orden a `PREPARING`.
4. Cambia la orden a `READY`.
5. Publica `kitchen.ready`.

Ademas de publicar eventos, sincroniza el estado derivado hacia `order-service`:

- `PREPARING` -> `IN_KITCHEN`
- `READY` -> `READY_FOR_DELIVERY`
- `CANCELLED` -> `CANCELLED`

Si el servicio esta caido, RabbitMQ mantiene los mensajes en cola. Cuando vuelve a levantarse, los consume automaticamente.

## Reglas de estado

Comportamiento relevante al actualizar una orden de cocina:

- al crear una orden nueva, inicia en `PENDING`;
- al pasar a `PREPARING`, se registra `started_at` si todavia estaba vacio;
- al pasar a `READY`, se asegura `started_at` y se registra `ready_at`;
- al pasar a `CANCELLED`, `ready_at` vuelve a `null`.

La creacion es idempotente por `orderId`. Si llega otra solicitud para la misma orden, reutiliza la existente en lugar de crear una duplicada.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/kitchen/orders` | Lista ordenes de cocina |
| `GET` | `/kitchen/orders/{id}` | Consulta una orden |
| `POST` | `/kitchen/orders` | Crea una orden manualmente |
| `PATCH` | `/kitchen/orders/{id}/status` | Actualiza estado |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

Notas de uso:

- `POST /kitchen/orders` crea o reutiliza una orden segun `orderId`.
- `PATCH /kitchen/orders/{id}/status` acepta estados de `KitchenOrderStatus`.
- el flujo automatico de la Saga normalmente avanza `PENDING -> PREPARING -> READY`.

## Observabilidad

Registra logs cuando:

- consume una reserva de inventario.
- crea o reutiliza una orden de cocina existente.
- cambia estado de preparacion.
- sincroniza estado hacia `order-service`.
- publica `kitchen.ready`.
- ocurre un error.

## Docker

```bash
docker compose up --build -d kitchen-service
docker compose logs -f kitchen-service
```
