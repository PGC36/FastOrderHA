# Base de datos

## Resumen

FastOrder HA usa una base PostgreSQL general llamada `fastorder_db` para todos los microservicios. La capa HA ahora corre con `Patroni + etcd + HAProxy`:

- Base: `fastorder_db`
- Usuario de aplicacion: `fastorder_user`
- Password de aplicacion: `fastorder123`
- Endpoint unico para la app: `fastorder-db`
- Nodo Patroni 1: `fastorder-db-0`
- Nodo Patroni 2: `fastorder-db-1`
- Nodo Patroni 3: `fastorder-db-2`
- Puerto local: `5440`
- Script principal: `database/fastorder-init.sql`

Todos los microservicios siguen usando el mismo host interno `fastorder-db:5432`. `HAProxy` enruta al lider actual y `Patroni` coordina el failover usando `etcd`.

## Componentes del cluster

| Servicio | Funcion | Puerto local |
|---|---|---:|
| `fastorder-db` | `HAProxy` hacia el lider PostgreSQL | `5440` |
| `fastorder-db-0` | Nodo PostgreSQL administrado por Patroni | interno |
| `fastorder-db-1` | Nodo PostgreSQL administrado por Patroni | interno |
| `fastorder-db-2` | Nodo PostgreSQL administrado por Patroni | interno |
| `etcd-0` | Coordinacion del cluster | interno |
| `etcd-1` | Coordinacion del cluster | interno |
| `etcd-2` | Coordinacion del cluster | interno |

## Convencion de conexion

### Desde la maquina local

```text
jdbc:postgresql://localhost:5440/fastorder_db
```

### Desde otro contenedor dentro de Docker Compose

```text
jdbc:postgresql://fastorder-db:5432/fastorder_db
```

La aplicacion nunca se conecta directo a `fastorder-db-0`, `fastorder-db-1` o `fastorder-db-2`.

## Failover

Flujo esperado:

1. `Patroni` elige un lider entre los tres nodos.
2. `HAProxy` expone siempre `fastorder-db:5432`.
3. Si el lider cae, `Patroni` promueve una replica sana.
4. `HAProxy` empieza a enviar trafico al nuevo lider.
La app mantiene la misma URL JDBC durante todo el proceso. Puede existir una ventana corta de errores mientras se completa la promocion, por eso los consumidores y las pruebas resilientes usan reintentos.

Como apoyo operativo, `db-recovery` puede volver a levantar un nodo caido si fue apagado manualmente durante una prueba.

## Permisos y bootstrap

El bootstrap crea la base y ejecuta `database/fastorder-init.sql` con `fastorder_user`, no con `postgres`. Eso deja ownership y permisos consistentes para que la app y las pruebas SQL usen el mismo usuario.

Permisos aplicados:

- `fastorder_user` es owner del esquema `public`.
- `fastorder_user` tiene permisos sobre tablas y secuencias existentes.
- los objetos futuros tambien heredan permisos mediante default privileges.

## Tablas incluidas

| Dominio | Tablas |
|---|---|
| Menu | `productos` |
| Inventario | `inventory`, `inventory_sales`, `inventory_reservations` |
| Pedidos | `orders`, `outbox_events` |
| Cocina | `kitchen_orders` |
| Entregas | `delivery_orders`, `delivery_status_history` |
| Notificaciones | `notifications` |

## Relaciones

Todas las tablas viven en `fastorder_db`. La mayoria de relaciones se mantienen como referencias logicas para no acoplar mas los microservicios. La excepcion actual es `delivery_status_history.delivery_order_id`, que si usa foreign key real hacia `delivery_orders(id)`.

- `inventory.product_id` apunta logicamente a `productos.id`
- `inventory_sales.product_id` apunta logicamente a `productos.id`
- `inventory_sales.order_id` apunta logicamente a `orders.id`
- `inventory_reservations.product_id` apunta logicamente a `productos.id`
- `inventory_reservations.order_id` apunta logicamente a `orders.id`
- `orders.product_id` apunta logicamente a `productos.id`
- `kitchen_orders.order_id` apunta logicamente a `orders.id`
- `delivery_orders.order_id` apunta logicamente a `orders.id`
- `notifications.order_id` apunta logicamente a `orders.id`
- `outbox_events.aggregate_id` apunta logicamente a `orders.id`

## Archivos relacionados

- [docker-compose.infra-db.yml](../docker-compose.infra-db.yml)
- [docker-compose.yml](../docker-compose.yml)
- [fastorder-init.sql](../database/fastorder-init.sql)
- [backups.md](./backups.md)
