# Endpoints

Los endpoints se consumen principalmente por medio del API Gateway:

```text
http://localhost:8080
```

Los microservicios tambien exponen puertos locales para depuracion, pero en la demo se recomienda usar siempre el gateway.

## API Gateway

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/actuator/health` | Health del gateway |
| `GET` | `/actuator/prometheus` | Metricas Prometheus del gateway |

## Menu

| Metodo | Endpoint gateway | Descripcion |
|---|---|---|
| `GET` | `/api/menu/productos` | Lista productos |
| `GET` | `/api/menu/productos/disponibles` | Lista productos disponibles |

## Inventario

| Metodo | Endpoint gateway | Descripcion |
|---|---|---|
| `GET` | `/api/inventory/check?productId=1&quantity=1` | Consulta disponibilidad de stock |
| `POST` | `/api/inventory/reserve` | Reserva stock manualmente |
| `POST` | `/api/inventory/release` | Libera stock manualmente |

## Pedidos

| Metodo | Endpoint gateway | Descripcion |
|---|---|---|
| `POST` | `/api/orders` | Crea una orden |
| `GET` | `/api/orders` | Lista ordenes |
| `GET` | `/api/orders/{id}` | Consulta una orden por ID |

Ejemplo:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8080/api/orders `
  -ContentType "application/json" `
  -Body '{"productId":1,"quantity":1,"deliveryAddress":"Zona 1","idempotencyKey":"demo-001"}'
```

Body:

```json
{
  "productId": 1,
  "quantity": 1,
  "deliveryAddress": "Zona 1",
  "idempotencyKey": "demo-001"
}
```

## Cocina

| Metodo | Endpoint gateway | Descripcion |
|---|---|---|
| `GET` | `/api/kitchen/orders` | Lista ordenes de cocina |

## Delivery

| Metodo | Endpoint gateway | Descripcion |
|---|---|---|
| `POST` | `/api/delivery` | Crea una entrega manualmente |
| `GET` | `/api/delivery/{id}` | Consulta entrega por ID |
| `GET` | `/api/delivery/by-order/{orderId}` | Consulta entrega por pedido |
| `PATCH` | `/api/delivery/{id}/assign` | Asigna repartidor |
| `PATCH` | `/api/delivery/{id}/pick-up` | Marca recogida |
| `PATCH` | `/api/delivery/{id}/in-transit` | Marca en transito |
| `PATCH` | `/api/delivery/{id}/deliver` | Marca entregada |
| `PATCH` | `/api/delivery/{id}/fail` | Marca fallida |
| `PATCH` | `/api/delivery/{id}/cancel` | Cancela entrega |

## Notificaciones

| Metodo | Endpoint gateway | Descripcion |
|---|---|---|
| `POST` | `/api/notifications` | Crea una notificacion manualmente |
| `GET` | `/api/notifications/{id}` | Consulta notificacion por ID |

## Observabilidad por servicio

Cada servicio Spring Boot expone:

| Endpoint | Uso |
|---|---|
| `/actuator/health` | Estado del servicio |
| `/actuator/prometheus` | Metricas para Prometheus |

Puertos directos:

| Servicio | Puerto |
|---|---:|
| `api-gateway` | `8080` |
| `menu-service` | `8081` |
| `order-service` | `8082` |
| `inventory-service` | `8083` |
| `kitchen-service` | `8084` |
| `delivery-service` | `8085` |
| `notification-service` | `8086` |

## Verificacion de negocio

Despues de ejecutar pruebas de carga o caos:

```powershell
node .\monitoring\check-results.js
```

El resultado final sano debe mostrar `Status: DONE`, `outbox pending = 0`, RabbitMQ vacio, `reserved = 0` y sin duplicidad de idempotency keys.
