# Arquitectura

## Resumen

FastOrder HA esta organizado como una arquitectura de microservicios orientada a eventos. La entrada principal es `api-gateway`, los servicios comparten una base PostgreSQL general llamada `fastorder_db` y el flujo de pedidos se coordina con RabbitMQ mediante un patron Saga.

La arquitectura actual prioriza:

- consistencia de negocio mediante estados de orden.
- idempotencia en creacion de pedidos.
- procesamiento asincrono por colas durables.
- workers paralelos por servicio.
- rate limiting centralizado con Redis en el API Gateway.
- observabilidad con Prometheus, Grafana, cAdvisor y metricas de RabbitMQ.

## Componentes

| Componente | Responsabilidad | Puerto local |
|---|---|---:|
| `api-gateway` | Entrada HTTP centralizada y rate limiting con Redis | `8080` |
| `menu-service` | Catalogo de productos | `8081` |
| `order-service` | Ordenes, idempotencia, outbox y estado global | `8082` |
| `inventory-service` | Reserva, liberacion y confirmacion de ventas de stock | `8083` |
| `kitchen-service` | Preparacion de ordenes | `8084` |
| `delivery-service` | Entrega y reintentos de despacho | `8085` |
| `notification-service` | Persistencia de notificaciones | `8086` |
| `fastorder-db` | PostgreSQL general | `5440` |
| `rabbitmq` | Broker de eventos | `5672`, `15672`, `15692` |
| `redis` | Rate limiting del API Gateway | `6379` |
| `prometheus` | Recoleccion de metricas | `9090` |
| `grafana` | Dashboards | `3000` |
| `cadvisor` | CPU y memoria de contenedores | `8087` |

## Estructura del repositorio

```text
FASTORDERHA/
|-- api-gateway/
|-- menu-service/
|-- inventory-service/
|-- order-service/
|-- kitchen-service/
|-- delivery-service/
|-- notification-service/
|-- database/
|-- monitoring/
|-- docs/
`-- docker-compose.yml
```

## Saga de pedidos

El pedido se crea rapido y luego avanza por eventos:

1. `order-service` recibe `POST /api/orders`, valida idempotencia y crea la orden en estado `PENDING`.
2. `order-service` guarda un evento `order.created` en `outbox_events`.
3. El publisher de outbox publica el evento en RabbitMQ.
4. `inventory-service` consume el evento y reserva stock.
5. Si no hay stock, publica `inventory.rejected` y `order-service` marca la orden como `CANCELLED`.
6. Si hay stock, publica `inventory.reserved`.
7. `kitchen-service` consume `inventory.reserved`, prepara la orden y publica `kitchen.ready`.
8. `delivery-service` consume `kitchen.ready`, procesa la entrega y publica `delivery.completed` o `delivery.failed`.
9. `order-service` consume eventos de delivery para marcar `COMPLETED`, reintentar o abandonar.
10. `inventory-service` consume `delivery.completed` y convierte la reserva en venta: baja `quantity`, baja `reserved` y sube `sold`.
11. `notification-service` consume `notification.created.queue` y guarda la notificacion.

## Confirmacion de venta

FastOrder HA no implementa un microservicio de pagos. Para el alcance actual del proyecto, la confirmacion comercial se modela como una venta de inventario cuando la entrega termina correctamente.

La venta se confirma solo cuando `inventory-service` consume `delivery.completed`. En ese momento registra la fila en `inventory_sales` y actualiza inventario de forma idempotente:

- `quantity` baja.
- `reserved` baja.
- `sold` sube.

La columna unica `inventory_sales.order_id` evita descontar dos veces si RabbitMQ reentrega el mismo evento.

## Colas principales

| Evento | Cola consumidora | Servicio consumidor |
|---|---|---|
| `order.created` | `inventory.order-created.queue` | `inventory-service` |
| `inventory.reserved` | `kitchen.inventory-reserved.queue` | `kitchen-service` |
| `inventory.rejected` | `order.inventory-rejected.queue` | `order-service` |
| `kitchen.ready` | `delivery.kitchen-ready.queue` | `delivery-service` |
| `delivery.completed` | `order.delivery-completed.queue` | `order-service` |
| `delivery.completed` | `inventory.delivery-completed.queue` | `inventory-service` |
| `delivery.failed` | `order.delivery-failed.queue` | `order-service` |
| `notification.created` | `notification.created.queue` | `notification-service` |

## Estados de orden

| Estado | Significado |
|---|---|
| `PENDING` | Orden creada y esperando flujo asincrono |
| `CANCELLED` | Orden cancelada antes de prepararse, con compensacion de stock cuando aplica |
| `READY_FOR_DELIVERY` | Cocina termino y la orden queda lista para despacho |
| `COMPLETED` | Delivery completo y orden cerrada correctamente |
| `ABANDONED` | Delivery fallo luego de agotar reintentos; no se devuelve inventario porque la comida ya fue preparada |

## Base de datos

Todos los servicios usan `fastorder_db` y tablas separadas por dominio:

- `productos`
- `inventory`
- `inventory_sales`
- `orders`
- `outbox_events`
- `kitchen_orders`
- `delivery_orders`
- `delivery_status_history`
- `notifications`

Mas detalle en [database.md](./database.md).

## Observabilidad

La observabilidad local incluye:

- Spring Actuator y Micrometer en los servicios.
- Prometheus para recolectar metricas.
- Grafana para ver dashboards.
- cAdvisor para CPU y memoria de contenedores.
- RabbitMQ Prometheus plugin para colas, consumidores y mensajes pendientes.

URLs:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- RabbitMQ Management: `http://localhost:15672`
- cAdvisor: `http://localhost:8087`

## Redis y proteccion de entrada

Redis se usa en `api-gateway` para aplicar rate limiting por cliente antes de enrutar hacia los microservicios. El limite por defecto es alto para permitir la prueba de 50,000 peticiones:

```text
API_RATE_LIMIT_CAPACITY=100000
API_RATE_LIMIT_WINDOW_SECONDS=60
API_RATE_LIMIT_FAIL_OPEN=true
```

Con `fail-open=true`, si Redis se reinicia o queda temporalmente no disponible, el gateway sigue aceptando trafico y marca la respuesta con `X-RateLimit-Redis: unavailable`. Esto permite degradacion controlada sin tumbar operaciones criticas.

## Rendimiento validado

Se agregaron scripts k6 para:

- carga minima de 50,000 ordenes por `POST /api/orders`.
- carga concurrente sostenida.
- picos de escritura.
- picos de lectura.

La prueba final antes de replicas y backups proceso 50,000 ordenes con error HTTP 0 y termino con 50,000 ordenes en `COMPLETED`. Tambien se valido inventario insuficiente: el sistema vendio solo el stock disponible, cancelo el resto y termino con `reserved = 0`.

Mas detalle en [load-testing-k6.md](./load-testing-k6.md).

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [database.md](./database.md)
- [deployment.md](./deployment.md)
- [load-testing-k6.md](./load-testing-k6.md)
- [monitoring/k6/README.md](../monitoring/k6/README.md)
