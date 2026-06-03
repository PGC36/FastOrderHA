# Arquitectura

## Resumen

FastOrder HA esta organizado como una arquitectura de microservicios orientada a eventos. La entrada principal es `api-gateway`, los servicios comparten una base `fastorder_db` y el flujo de pedidos se coordina con RabbitMQ mediante una Saga.

La arquitectura actual prioriza:

- consistencia de negocio mediante estados de orden;
- idempotencia en creacion de pedidos;
- procesamiento asincrono por colas durables;
- workers paralelos por servicio;
- alta disponibilidad de PostgreSQL con `Patroni + etcd + HAProxy`;
- backups automaticos y recuperacion operativa;
- observabilidad con Prometheus, Grafana, cAdvisor y metricas de RabbitMQ.

## Componentes

| Componente | Responsabilidad | Puerto local |
|---|---|---:|
| `api-gateway` | Entrada HTTP centralizada | `8080` |
| `menu-service` | Catalogo de productos | `8081` |
| `order-service` | Ordenes, idempotencia, outbox y estado global | `8082` |
| `inventory-service` | Reserva, liberacion y confirmacion de ventas | `8083` |
| `kitchen-service` | Preparacion de ordenes | `8084` |
| `delivery-service` | Entrega y reintentos de despacho | `8085` |
| `notification-service` | Persistencia de notificaciones | `8086` |
| `fastorder-db` | `HAProxy` hacia PostgreSQL HA | `5440` |
| `fastorder-db-0` | Nodo Patroni/PostgreSQL | interno |
| `fastorder-db-1` | Nodo Patroni/PostgreSQL | interno |
| `fastorder-db-2` | Nodo Patroni/PostgreSQL | interno |
| `etcd-0` | Coordinacion del cluster Patroni | interno |
| `etcd-1` | Coordinacion del cluster Patroni | interno |
| `etcd-2` | Coordinacion del cluster Patroni | interno |
| `db-recovery` | Watcher Docker para volver a levantar nodos de BD caidos | interno |
| `postgres-backup` | Backups automaticos de PostgreSQL | interno |
| `dlq-recovery` | Reinyeccion automatica de mensajes DLQ | interno |
| `rabbitmq` | Broker de eventos | `5672`, `15672`, `15692` |
| `prometheus` | Recoleccion de metricas | `9090` |
| `grafana` | Dashboards | `3000` |
| `cadvisor` | CPU y memoria de contenedores | `8087` |

## Saga de pedidos

1. `order-service` recibe `POST /api/orders`, valida idempotencia y crea la orden `PENDING`.
2. `order-service` guarda un evento `order.created` en `outbox_events`.
3. El publisher de outbox publica el evento en RabbitMQ.
4. `inventory-service` reserva stock o rechaza el pedido.
5. `kitchen-service` prepara la orden si el stock fue reservado.
6. `delivery-service` procesa la entrega.
7. `order-service` actualiza el estado final.
8. `inventory-service` confirma la venta con `delivery.completed`.
9. `notification-service` registra la notificacion.

## Base de datos

Antes el proyecto tuvo bases separadas por servicio. Ahora todo esta consolidado en `fastorder_db`, con tablas por dominio y un endpoint unico `fastorder-db:5432`.

La capa HA funciona asi:

- `Patroni` administra tres nodos PostgreSQL;
- `etcd` mantiene el estado distribuido del cluster;
- `HAProxy` publica el endpoint unico para la app;
- `db-recovery` vuelve a levantar contenedores de BD caidos durante pruebas;
- `postgres-backup` ejecuta `pg_dump` contra el proxy.

Si el lider cae, Patroni promueve una replica sana y HAProxy empieza a dirigir trafico al nuevo lider. Puede existir una ventana corta de errores mientras termina la promocion, por eso la capa de mensajeria y las pruebas de caos trabajan con reintentos.

Tablas principales:

- `productos`
- `inventory`
- `inventory_sales`
- `inventory_reservations`
- `orders`
- `outbox_events`
- `kitchen_orders`
- `delivery_orders`
- `delivery_status_history`
- `notifications`

## Observabilidad

La observabilidad local incluye:

- Spring Actuator y Micrometer en los servicios;
- Prometheus para recolectar metricas;
- Grafana para dashboards;
- cAdvisor para CPU y memoria de contenedores;
- RabbitMQ Prometheus plugin para colas, consumidores y mensajes pendientes;
- exporters de PostgreSQL para los tres nodos y el proxy.

## Rendimiento validado

Las pruebas actuales validaron 50,000 pedidos, inventario insuficiente, caida de microservicios, caida del lider PostgreSQL, recuperacion automatica y restauracion desde backup. El resultado final esperado es `Status: DONE`, `outbox pending = 0`, RabbitMQ sin colas pendientes e inventario consistente.

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [database.md](./database.md)
- [backups.md](./backups.md)
- [deployment.md](./deployment.md)
