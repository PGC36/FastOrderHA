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

## Comportamiento en la Saga

1. Recibe `inventory.reserved`.
2. Crea una orden de cocina de forma idempotente por `orderId`.
3. Cambia la orden a `PREPARING`.
4. Cambia la orden a `READY`.
5. Publica `kitchen.ready`.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/kitchen/orders` | Lista ordenes de cocina |
| `GET` | `/kitchen/orders/{id}` | Consulta una orden |
| `POST` | `/kitchen/orders` | Crea una orden manualmente |
| `PATCH` | `/kitchen/orders/{id}/status` | Actualiza estado |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

## Observabilidad

Registra logs cuando:

- consume una reserva de inventario.
- crea o reutiliza una orden de cocina existente.
- cambia estado de preparacion.
- publica `kitchen.ready`.
- ocurre un error.

## Docker

```bash
docker compose up --build -d kitchen-service
docker compose logs -f kitchen-service
```
