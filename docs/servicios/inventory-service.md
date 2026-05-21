# inventory-service

## Responsabilidad

`inventory-service` protege el stock del restaurante. Es el dueno funcional de `inventory` e `inventory_sales`, y participa en la Saga reservando inventario cuando llega una orden y confirmando la venta cuando delivery termina correctamente.

## Puerto

```text
8083
```

## Base de datos

Usa PostgreSQL general:

```text
fastorder_db
```

Tablas principales:

- `inventory`
- `inventory_sales`

Campos clave de `inventory`:

- `product_id` — identificador del producto.
- `quantity` — unidades fisicas en existencia.
- `reserved` — unidades comprometidas por ordenes en curso.
- `sold` — unidades ya vendidas y entregadas.

El stock disponible se calcula como:

```text
quantity - reserved
```

Cuando una entrega se completa, la reserva se convierte en venta:

```text
quantity  -= cantidad_vendida
reserved  -= cantidad_vendida
sold      += cantidad_vendida
```

`inventory_sales.order_id` tiene restriccion `UNIQUE` para que un redelivery de `delivery.completed` no descuente dos veces.

## RabbitMQ

Consume:

| Cola | Evento |
|---|---|
| `inventory.order-created.queue` | `order.created` |
| `inventory.delivery-completed.queue` | `delivery.completed` |

Publica:

| Evento | Significado |
|---|---|
| `inventory.reserved` | Stock reservado correctamente; la orden avanza a cocina |
| `inventory.rejected` | Stock insuficiente o error de reserva; la orden se cancela |

Configuracion relevante:

```text
INVENTORY_ORDER_CREATED_CONSUMERS=8
INVENTORY_DELIVERY_COMPLETED_CONSUMERS=4
SPRING_RABBITMQ_LISTENER_SIMPLE_PREFETCH=20
SPRING_RABBITMQ_LISTENER_SIMPLE_CONCURRENCY=8
SPRING_RABBITMQ_LISTENER_SIMPLE_MAX_CONCURRENCY=16
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

## Comportamiento en la Saga

### Flujo de reserva

1. Recibe `order.created` desde `inventory.order-created.queue`.
2. Verifica stock disponible: `quantity - reserved >= cantidad_solicitada`.
3. Si no hay stock suficiente, publica `inventory.rejected` y la orden se cancela en `order-service`.
4. Si hay stock, incrementa `reserved` de forma transaccional y publica `inventory.reserved`.
5. `kitchen-service` consume `inventory.reserved` y comienza la preparacion.

### Flujo de confirmacion de venta

1. Recibe `delivery.completed` desde `inventory.delivery-completed.queue`.
2. Verifica idempotencia por `order_id` en `inventory_sales`.
3. Si la venta ya fue registrada, descarta el evento sin modificar datos.
4. Si es nueva, registra la fila en `inventory_sales` y actualiza `inventory` de forma atomica.

Si el servicio esta caido, RabbitMQ mantiene los mensajes en cola. Cuando vuelve a levantarse, los consume automaticamente.

## Reglas de negocio

- No se permite reservar mas stock del disponible (`quantity - reserved`).
- La reserva es transaccional; si falla a mitad, no se modifica el inventario.
- Si no hay stock, se publica `inventory.rejected` y la orden queda `CANCELLED`.
- Si hay stock, se incrementa `reserved` y la orden avanza hacia cocina.
- Si la orden falla antes de cocina (rechazo de inventario), el stock no fue reservado y no requiere compensacion.
- Si delivery se completa, la reserva se confirma como venta de forma idempotente.
- Si delivery falla despues de cocina, no se devuelve inventario porque la comida ya fue preparada.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/inventory/check?productId={id}&quantity={n}` | Verifica disponibilidad sin modificar stock |
| `POST` | `/inventory/reserve` | Reserva stock para una orden |
| `POST` | `/inventory/release` | Libera una reserva (compensacion manual) |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

Notas de uso:

- `GET /inventory/check` es de solo lectura y no aplica reserva.
- `POST /inventory/reserve` es idempotente por `orderId`; si la reserva ya existe para esa orden, no duplica el descuento.
- `POST /inventory/release` se usa para compensacion manual o en pruebas de caos; en el flujo normal la compensacion no aplica tras cocina.

## Observabilidad

Registra logs cuando:

- consume `order.created`.
- verifica disponibilidad de stock.
- reserva stock correctamente.
- rechaza una orden por stock insuficiente.
- consume `delivery.completed`.
- confirma la venta en `inventory_sales`.
- detecta venta duplicada y descarta por idempotencia.
- publica `inventory.reserved` o `inventory.rejected`.
- ocurre un error de procesamiento.

## Docker

```bash
docker compose up --build -d inventory-service
docker compose logs -f inventory-service
```
