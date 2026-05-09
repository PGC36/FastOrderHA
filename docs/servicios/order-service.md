# order-service

## Descripcion

`order-service` es el microservicio responsable de la gestion inicial de pedidos dentro de FastOrder HA. Actualmente funciona como orquestador inicial del flujo critico de creacion de pedidos.

El servicio recibe solicitudes HTTP, valida los datos de entrada, aplica idempotencia mediante `idempotencyKey`, guarda el pedido en la base general `fastorder_db` y registra un evento en la tabla `outbox_events`.

## Responsabilidad actual

- Crear pedidos con estado inicial `PENDING`.
- Consultar pedidos existentes.
- Evitar pedidos duplicados mediante idempotencia.
- Registrar eventos `order.created` usando Outbox Pattern.
- Dejar preparado el punto de integracion futura con `inventory-service`.

## Tecnologias usadas

| Tecnologia | Uso |
| --- | --- |
| Java 21 | Runtime del servicio |
| Spring Boot 3.5.14 | Base de la aplicacion |
| Spring Web | API REST |
| Spring Data JPA | Persistencia |
| PostgreSQL Driver | Conexion con `fastorder_db` |
| Spring for RabbitMQ | Preparacion para mensajeria |
| Spring Boot Actuator | Endpoints de monitoreo |
| Micrometer Prometheus | Metricas |
| Validation | Validacion de DTOs |
| Maven | Gestion de dependencias y build |

## Puerto

| Entorno | Puerto |
| --- | --- |
| order-service | `8082` |

## Base de datos

`order-service` usa la base general del proyecto:

| Propiedad | Valor |
| --- | --- |
| Base de datos | `fastorder_db` |
| Contenedor | `fastorder-db` |
| Puerto local | `5440` |
| Puerto interno Docker | `5432` |
| Usuario | `fastorder_user` |
| Contrasena | `fastorder123` |

## Tablas usadas

- `orders`
- `outbox_events`

## Integracion con RabbitMQ

El servicio tiene Spring AMQP configurado y declara:

- exchange: `order.exchange`
- cola: `order.events.queue`
- routing key: `order.event`

## Endpoints implementados

| Metodo | Endpoint | Descripcion |
| --- | --- | --- |
| `GET` | `/orders/health-check` | Verifica que el servicio responda |
| `POST` | `/orders` | Crea un pedido |
| `GET` | `/orders` | Lista todos los pedidos |
| `GET` | `/orders/{id}` | Consulta un pedido por ID |
| `GET` | `/actuator/health` | Estado de salud del servicio |
| `GET` | `/actuator/prometheus` | Metricas en formato Prometheus |

## Ejemplo de peticion POST /orders

```json
{
  "productId": 1,
  "quantity": 1,
  "idempotencyKey": "pedido-cliente-001"
}
```

## Ejemplo de respuesta exitosa

```json
{
  "id": 1,
  "idempotencyKey": "pedido-cliente-001",
  "productId": 1,
  "quantity": 1,
  "status": "PENDING",
  "createdAt": "2026-05-07T17:54:31.742867"
}
```

## Idempotencia

La creacion de pedidos usa el campo `idempotencyKey` para evitar duplicados.

Si llega una solicitud con un `idempotencyKey` que ya existe en la tabla `orders`, el servicio no crea un nuevo registro. En su lugar, devuelve el pedido existente y registra un log indicando que se detecto una solicitud idempotente.

Esto permite reintentar solicitudes desde clientes o sistemas externos sin duplicar pedidos.

## Outbox Pattern

Cuando se crea un pedido nuevo, `order-service` tambien crea un registro en `outbox_events` con:

| Campo | Valor actual |
| --- | --- |
| `aggregate_type` | `ORDER` |
| `aggregate_id` | ID del pedido creado |
| `event_type` | `order.created` |
| `payload` | JSON con `orderId`, `productId`, `quantity` y `status` |
| `processed` | `false` |

Actualmente el evento queda registrado en base de datos. La publicacion o procesamiento asincrono del outbox queda para una fase posterior.

## Errores controlados

El servicio usa `GlobalExceptionHandler` con `@RestControllerAdvice` para centralizar respuestas de error.

| Codigo | Caso | Respuesta |
| --- | --- | --- |
| `400 Bad Request` | DTO invalido | `Datos invalidos en la solicitud` |
| `404 Not Found` | Pedido no encontrado | `Pedido no encontrado con id {id}` |
| `409 Conflict` | Regla de negocio | Mensaje de la regla de negocio |
| `503 Service Unavailable` | `inventory-service` no disponible | Preparado para integracion futura |
| `500 Internal Server Error` | Error inesperado | `Error interno controlado en order-service` |

Formato general de error:

```json
{
  "timestamp": "2026-05-07T17:54:22.388793508",
  "status": 404,
  "error": "Not Found",
  "message": "Pedido no encontrado con id 999",
  "path": "/orders/999"
}
```

## Logs

El servicio registra logs con SLF4J en `OrderController`, `OrderService` y `GlobalExceptionHandler`.

Eventos registrados:

- Solicitud recibida para crear pedido.
- `idempotencyKey` recibido.
- Pedido duplicado detectado por idempotencia.
- Pedido creado correctamente.
- Evento `order.created` guardado en outbox.
- Errores de validacion.
- Pedidos no encontrados.
- Errores inesperados.

El formato configurado incluye fecha, nivel, nombre del servicio y mensaje:

```text
2026-05-07 11:54:31 INFO  order-service - Pedido creado correctamente con id=1
```

## Ejecucion con Docker

Levantar solo lo necesario para `order-service`:

```bash
docker compose up --build -d fastorder-db rabbitmq order-service
```

Levantar todo lo configurado en Docker Compose:

```bash
docker compose up --build -d
```

Ver logs del servicio:

```bash
docker compose logs -f order-service
```

## Pruebas recomendadas

```bash
curl http://localhost:8082/actuator/health
curl http://localhost:8082/orders/health-check
curl http://localhost:8082/orders
curl http://localhost:8082/orders/999
```

Crear un pedido:

```bash
curl -X POST http://localhost:8082/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":1,"idempotencyKey":"pedido-cliente-001"}'
```

Probar validacion:

```bash
curl -X POST http://localhost:8082/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":null,"quantity":0,"idempotencyKey":""}'
```

## Estado actual

`order-service` ya crea pedidos en estado `PENDING`, consulta pedidos, valida idempotencia y registra eventos en `outbox_events`.

La integracion real con `inventory-service` queda pendiente para una fase posterior. En el codigo existe el metodo `validateInventoryReservation`, preparado como punto de extension, pero actualmente no realiza una llamada remota.
