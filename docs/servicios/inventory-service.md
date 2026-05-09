# inventory-service

## Responsabilidad

`inventory-service` protege el stock del restaurante. Es el dueno funcional de la tabla `inventory` y participa en la Saga reservando inventario cuando llega una orden.

## Puerto

```text
8083
```

## Base de datos

Usa PostgreSQL general:

```text
fastorder_db
```

Tabla principal:

- `inventory`

Campos clave:

- `product_id`
- `quantity`
- `reserved`

El stock disponible se calcula como:

```text
quantity - reserved
```

## Reglas de negocio

- No se permite reservar mas stock del disponible.
- La reserva es transaccional.
- Si no hay stock, se publica rechazo y la orden se cancela.
- Si hay stock, se incrementa `reserved` y la orden avanza hacia cocina.
- Si la orden falla antes de cocina, el stock puede compensarse.
- Si delivery falla despues de cocina, no se devuelve inventario porque la comida ya fue preparada.

## RabbitMQ

Consume:

| Cola | Evento |
|---|---|
| `inventory.order-created.queue` | `order.created` |

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
- rechaza una orden por falta de stock.
- publica eventos de respuesta.
- ocurre un error de procesamiento.

## Docker

```bash
docker compose up --build -d inventory-service
docker compose logs -f inventory-service
```
