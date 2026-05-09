# delivery-service

## Responsabilidad

`delivery-service` gestiona la entrega de ordenes. En la Saga consume ordenes listas de cocina, crea el despacho, simula/procesa la entrega y publica el resultado.

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

## Comportamiento en la Saga

1. Recibe `kitchen.ready`.
2. Crea entrega idempotente por `orderId`.
3. Asigna repartidor.
4. Marca recogida.
5. Marca en transito.
6. Marca entregada o fallida.
7. Publica el evento correspondiente. Cuando publica `delivery.completed`, inventario lo usa para convertir la reserva en venta confirmada.

Si el servicio esta caido, RabbitMQ mantiene los mensajes en cola. Cuando vuelve a levantarse, los consume automaticamente.

## Regla de inventario

Si delivery falla despues de cocina, no se devuelve stock. En una operacion real, la comida ya fue preparada y el costo ya se consumio.

El reintento y abandono final lo decide `order-service`.

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

## Observabilidad

Registra logs cuando:

- consume `kitchen.ready`.
- crea o reutiliza una entrega.
- cambia estados de delivery.
- publica `delivery.completed`.
- publica `delivery.failed`.
- publica notificaciones.
- ocurre un error.

## Docker

```bash
docker compose up --build -d delivery-service
docker compose logs -f delivery-service
```
