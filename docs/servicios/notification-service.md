# notification-service

## Responsabilidad

`notification-service` registra notificaciones del ciclo de vida de pedidos. Actualmente consume eventos desde RabbitMQ y persiste las notificaciones en PostgreSQL.

## Puerto

```text
8086
```

## Base de datos

Usa PostgreSQL general:

```text
fastorder_db
```

Tabla principal:

- `notifications`

Campos clave:

- `order_id`
- `channel`
- `recipient`
- `message`
- `status`
- `created_at`

## RabbitMQ

Consume exactamente:

```text
notification.created.queue
```

El consumidor usa `@RabbitListener` y registra logs claros:

- mensaje recibido desde `notification.created.queue`.
- notificacion procesada correctamente.
- errores con nivel `ERROR` si falla el procesamiento.

## Comportamiento

1. Recibe `notification.created`.
2. Lee el payload del mensaje.
3. Crea la notificacion.
4. Marca el registro como procesado segun la logica del servicio.
5. Si ocurre un error, lo deja registrado en logs.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `POST` | `/notifications` | Crea una notificacion manual |
| `GET` | `/notifications/{id}` | Consulta notificacion |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

## Verificacion en RabbitMQ

RabbitMQ Management:

```text
http://localhost:15672
```

Credenciales:

```text
guest / guest
```

La cola `notification.created.queue` debe bajar a `Ready: 0` cuando `notification-service` esta levantado y consume correctamente.

## Docker

```bash
docker compose up --build -d notification-service
docker compose logs -f notification-service
```
