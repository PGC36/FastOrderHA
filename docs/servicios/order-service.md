# order-service

## Responsabilidad

`order-service` funciona como orquestador inicial del flujo crítico de creación de pedidos en FastOrder HA. Recibe solicitudes de pedidos, valida idempotencia, crea el pedido en estado inicial `PENDING` y registra un evento en `outbox_events` para habilitar integración asíncrona futura.

## Puerto

`8082`

## Base de datos

`order_db`

## Tablas usadas

- `orders`
- `outbox_events`

## Endpoints disponibles

- `GET /orders/health-check`
- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `GET /actuator/health`
- `GET /actuator/prometheus`

## Ejemplo de petición POST /orders

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
  "createdAt": "2026-05-06T23:59:00"
}
```

## Manejo de idempotencia

Si llega otra solicitud con el mismo `idempotencyKey`, el servicio no crea otro pedido. En su lugar, devuelve el pedido existente y registra un log indicando que se detectó idempotencia.

## Outbox Pattern

Cuando se crea un pedido, también se guarda un evento en `outbox_events` con `event_type = order.created`. El evento contiene un payload JSON simple con `orderId`, `productId`, `quantity` y `status`, y queda con `processed = false`.

## Errores controlados

- `400 Bad Request`: datos inválidos en la solicitud.
- `404 Not Found`: pedido no encontrado.
- `409 Conflict`: reglas de negocio.
- `503 Service Unavailable`: `inventory-service` no disponible en una futura integración.
- `500 Internal Server Error`: errores inesperados controlados.

## Logs

El servicio registra logs de:

- Solicitud recibida.
- `idempotencyKey` recibido.
- Pedido duplicado detectado por idempotencia.
- Pedido creado correctamente.
- Evento outbox creado.
- Errores controlados.
- Errores inesperados.

## Ejecución con Docker

```bash
docker compose up --build -d order-db rabbitmq order-service
```

## Pruebas recomendadas

- `GET http://localhost:8082/actuator/health`
- `GET http://localhost:8082/orders/health-check`
- `POST http://localhost:8082/orders`
- `GET http://localhost:8082/orders`
- `GET http://localhost:8082/orders/999`

## Estado actual

El servicio ya crea pedidos en estado `PENDING`, valida idempotencia y registra eventos en `outbox_events`. La integración real con `inventory-service` queda preparada para una siguiente fase mediante el método `validateInventoryReservation`.
