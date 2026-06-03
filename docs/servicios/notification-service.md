# notification-service

## Responsabilidad

`notification-service` registra notificaciones del ciclo de vida de pedidos. Expone API REST para crear/consultar notificaciones, publica eventos `notification.created` y consume esa misma cola para marcar notificaciones como procesadas.

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

- `id`
- `order_id` (unico)
- `channel`
- `recipient`
- `message`
- `status`
- `created_at`

Estados usados por el servicio:

- `PENDING`
- `PROCESSED`

## RabbitMQ

Consume:

| Cola | Evento |
|---|---|
| `notification.created.queue` | `notification.created` |

Publica:

| Evento | Significado |
|---|---|
| `notification.created` | Solicita procesar/confirmar una notificacion creada |

Configuracion relevante:

```text
NOTIFICATION_CREATED_CONSUMERS=8
SPRING_RABBITMQ_LISTENER_SIMPLE_PREFETCH=20
SPRING_RABBITMQ_LISTENER_SIMPLE_CONCURRENCY=8
SPRING_RABBITMQ_LISTENER_SIMPLE_MAX_CONCURRENCY=16
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=3
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=1000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=2
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=10000
```

Infraestructura de colas:

- `notification.exchange` (topic exchange)
- `notification.created.queue` (durable)
- `fastorder.dlx` (dead-letter exchange)
- `notification.created.queue.dlq` (cola DLQ)

## Comportamiento en la Saga

1. El flujo publica `notification.created` con datos de la notificacion.
2. `notification-service` consume `notification.created.queue`.
3. Si llega `notificationId`, intenta marcar esa notificacion en `PROCESSED`.
4. Si no llega `notificationId`, crea/actualiza notificacion por `orderId`.
5. Si faltan datos requeridos (`orderId`, `channel`, `recipient`), rechaza el mensaje con error.

Si el servicio esta caido, RabbitMQ conserva mensajes pendientes. Si un mensaje falla luego de los reintentos configurados, se enruta a DLQ.

## Reglas de idempotencia y consistencia

- `order_id` es unico en `notifications` para evitar duplicados por orden.
- `POST /notifications` reutiliza la notificacion existente si ya hay una para el mismo `orderId`.
- si existe y ya esta `PROCESSED`, no vuelve a publicar evento.
- si existe y no esta `PROCESSED`, vuelve a publicar `notification.created`.
- si no existe, crea en `PENDING` y publica evento.

Adicionalmente, existe reconciliacion programada:

- cada `5s` (configurable) busca ordenes `COMPLETED` sin notificacion.
- crea notificacion automatica con valores por defecto (`EMAIL`, `cliente@fastorder.test`) y mensaje de entrega.

## Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `POST` | `/notifications` | Crea o reutiliza una notificacion por `orderId` |
| `GET` | `/notifications/{id}` | Consulta notificacion |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

Notas de uso:

- `POST /notifications` requiere `orderId`, `channel`, `recipient`, `message`.
- validaciones: `channel` maximo `30`, `recipient` maximo `150`, campos requeridos no vacios.
- errores de validacion responden `400`.
- si no existe `id` en `GET /notifications/{id}`, responde `404`.

## Observabilidad

Registra logs cuando:

- recibe mensajes desde `notification.created.queue`.
- publica `notification.created`.
- crea notificacion por API.
- marca notificaciones como `PROCESSED`.
- ejecuta reconciliacion automatica.
- ocurre un error de procesamiento o validacion.

## Verificacion en RabbitMQ

RabbitMQ Management:

```text
http://localhost:15672
```

Credenciales:

```text
guest / guest
```

La cola `notification.created.queue` debe bajar a `Ready: 0` cuando `notification-service` esta levantado y consume correctamente. Si hay fallos persistentes, revisar `notification.created.queue.dlq`.

## Docker

```bash
docker compose up --build -d notification-service
docker compose logs -f notification-service
```
