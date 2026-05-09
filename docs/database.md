# Base de datos

## Resumen

FastOrder HA usa una base de datos PostgreSQL general para todos los microservicios:

- Base: `fastorder_db`
- Usuario: `fastorder_user`
- Password: `fastorder123`
- Contenedor: `fastorder-db`
- Puerto local: `5440`
- Script principal: `database/fastorder-init.sql`

Antes el proyecto tenia una base separada por servicio (`menu_db`, `inventory_db`, `order_db`, `kitchen_db`, `delivery_db` y `notification_db`). Ahora todos los servicios comparten la misma base fisica y mantienen tablas separadas por dominio.

## Configuracion en Docker Compose

`docker-compose.yml` levanta un solo contenedor PostgreSQL:

| Servicio | Base | Puerto local | Usuario | Password | Script |
|---|---|---:|---|---|---|
| `fastorder-db` | `fastorder_db` | `5440` | `fastorder_user` | `fastorder123` | `database/fastorder-init.sql` |

## Convencion de conexion

### Desde la maquina local

```text
jdbc:postgresql://localhost:5440/fastorder_db
```

### Desde otro contenedor dentro de Docker Compose

```text
jdbc:postgresql://fastorder-db:5432/fastorder_db
```

## Tablas incluidas

El script general crea todas las tablas que antes estaban repartidas por scripts de servicio.

| Dominio | Tablas |
|---|---|
| Menu | `productos` |
| Inventario | `inventory` |
| Pedidos | `orders`, `outbox_events` |
| Cocina | `kitchen_orders` |
| Entregas | `delivery_orders`, `delivery_status_history` |
| Notificaciones | `notifications` |

## Menu

### Tabla `productos`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador del producto |
| `nombre` | `VARCHAR(120)` | `NOT NULL` | Nombre del producto |
| `descripcion` | `VARCHAR(500)` | nullable | Descripcion del producto |
| `categoria` | `VARCHAR(80)` | `NOT NULL` | Categoria del producto |
| `disponible` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Disponibilidad para venta |
| `activo` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Estado logico del producto |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Fecha de creacion |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Fecha de actualizacion |

Dato inicial:

- inserta `Pollo Frito` si no existe conflicto.

## Inventario

### Tabla `inventory`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador interno |
| `product_id` | `BIGINT` | `UNIQUE`, `NOT NULL` | Referencia logica al producto |
| `quantity` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Stock disponible |
| `reserved` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Stock reservado |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creacion |
| `updated_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de actualizacion |

Dato inicial:

- inserta `product_id = 1` con `quantity = 100` y `reserved = 0`.

## Pedidos

### Tabla `orders`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `SERIAL` | Primary key | Identificador del pedido |
| `idempotency_key` | `VARCHAR(150)` | `UNIQUE`, `NOT NULL` | Clave de idempotencia |
| `product_id` | `INT` | `NOT NULL` | Referencia logica al producto |
| `quantity` | `INT` | `NOT NULL`, `CHECK (quantity > 0)` | Cantidad solicitada |
| `status` | `VARCHAR(50)` | `NOT NULL` | Estado actual del pedido |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Fecha de creacion |

### Tabla `outbox_events`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `SERIAL` | Primary key | Identificador del evento |
| `aggregate_type` | `VARCHAR(100)` | `NOT NULL` | Tipo de agregado |
| `aggregate_id` | `INT` | `NOT NULL` | ID del agregado relacionado |
| `event_type` | `VARCHAR(100)` | `NOT NULL` | Tipo de evento |
| `payload` | `TEXT` | `NOT NULL` | Contenido del evento |
| `processed` | `BOOLEAN` | `DEFAULT FALSE` | Indicador de procesamiento |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Fecha de creacion |

## Cocina

### Tabla `kitchen_orders`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador interno |
| `order_id` | `BIGINT` | `UNIQUE`, `NOT NULL` | Referencia logica al pedido |
| `status` | `VARCHAR(50)` | `NOT NULL`, `CHECK (...)` | Estado de cocina |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de creacion |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de actualizacion |
| `started_at` | `TIMESTAMP` | nullable | Inicio de preparacion |
| `ready_at` | `TIMESTAMP` | nullable | Momento en que queda lista |

Estados permitidos: `PENDING`, `PREPARING`, `READY`, `CANCELLED`.

## Entregas

### Tabla `delivery_orders`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador de la entrega |
| `order_id` | `BIGINT` | `UNIQUE`, `NOT NULL` | Referencia logica al pedido |
| `status` | `VARCHAR(50)` | `NOT NULL`, `CHECK (...)` | Estado actual de la entrega |
| `assigned_driver_id` | `BIGINT` | nullable | Repartidor asignado |
| `delivery_address` | `VARCHAR(500)` | `NOT NULL` | Direccion de entrega |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de creacion |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de actualizacion |
| `version` | `BIGINT` | `NOT NULL`, `DEFAULT 0` | Control de concurrencia optimista |

Estados permitidos: `PENDING`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `FAILED`, `CANCELLED`.

### Tabla `delivery_status_history`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador del registro |
| `delivery_order_id` | `BIGINT` | `NOT NULL`, foreign key | Entrega asociada |
| `previous_status` | `VARCHAR(50)` | nullable | Estado anterior |
| `new_status` | `VARCHAR(50)` | `NOT NULL` | Nuevo estado |
| `reason` | `VARCHAR(255)` | nullable | Motivo del cambio |
| `changed_by` | `VARCHAR(100)` | nullable | Actor que hizo el cambio |
| `changed_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha del cambio |

## Notificaciones

### Tabla `notifications`

| Columna | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador de la notificacion |
| `order_id` | `BIGINT` | `NOT NULL` | Referencia logica al pedido |
| `channel` | `VARCHAR(30)` | `NOT NULL` | Canal de envio |
| `recipient` | `VARCHAR(150)` | `NOT NULL` | Destinatario |
| `message` | `TEXT` | `NOT NULL` | Contenido del mensaje |
| `status` | `VARCHAR(30)` | `NOT NULL`, `DEFAULT 'PENDING'` | Estado de la notificacion |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Fecha de creacion |

## Relaciones

Como ahora todas las tablas viven en `fastorder_db`, es posible agregar foreign keys entre dominios en el futuro. Por ahora se mantienen las relaciones logicas existentes para evitar cambiar el comportamiento de los microservicios:

- `inventory.product_id` apunta logicamente a `productos.id`
- `orders.product_id` apunta logicamente a `productos.id`
- `kitchen_orders.order_id` apunta logicamente a `orders.id`
- `delivery_orders.order_id` apunta logicamente a `orders.id`
- `notifications.order_id` apunta logicamente a `orders.id`
- `outbox_events.aggregate_id` apunta logicamente a `orders.id`

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [fastorder-init.sql](../database/fastorder-init.sql)
