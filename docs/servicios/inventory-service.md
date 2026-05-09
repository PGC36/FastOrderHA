# inventory-service

## Responsabilidad

`inventory-service` protege el stock del restaurante. Es el dueno funcional de `inventory` e `inventory_sales`, y participa en la Saga reservando inventario cuando llega una orden y confirmando la venta cuando delivery termina.

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

Campos clave:

- `product_id`
- `quantity`
- `reserved`
- `sold`

El stock disponible se calcula como:

```text
quantity - reserved
```

Cuando una entrega se completa, la reserva se convierte en venta:

```text
quantity -= quantity
reserved -= quantity
sold += quantity
```

`inventory_sales.order_id` es unico para que un redelivery de `delivery.completed` no descuente dos veces.

## Reglas de negocio

- No se permite reservar mas stock del disponible.
- La reserva es transaccional.
- Si no hay stock, se publica rechazo y la orden se cancela.
- Si hay stock, se incrementa `reserved` y la orden avanza hacia cocina.
- Si la orden falla antes de cocina, el stock puede compensarse.
- Si delivery se completa, la reserva se confirma como venta.
- Si delivery falla despues de cocina, no se devuelve inventario porque la comida ya fue preparada.

## RabbitMQ

Consume:

| Cola | Evento |
|---|---|
| `inventory.order-created.queue` | `order.created` |
| `inventory.delivery-completed.queue` | `delivery.completed` |

Publica:

| Evento | Significado |
|---|---|
| `inventory.reserved` | Stock reservado correctamente |
| `inventory.rejected` | Stock insuficiente o error de reserva |

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/inventory/check?productId={id}&quantity={cantidad}` | Verifica disponibilidad |
| `POST` | `/inventory/reserve` | Reserva stock |
| `POST` | `/inventory/release` | Libera stock reservado |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

## Observabilidad

Registra logs cuando:

- recibe una orden desde RabbitMQ.
- reserva stock correctamente.
- confirma ventas por `delivery.completed`.
- rechaza una orden por falta de stock.
- publica eventos de respuesta.
- ocurre un error de procesamiento.

## Docker

```bash
docker compose up --build -d inventory-service
docker compose logs -f inventory-service
```
