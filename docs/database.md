# Base de datos

## Resumen

FastOrder HA usa una base de datos PostgreSQL separada por microservicio. Este enfoque reduce acoplamiento entre dominios y evita compartir esquemas entre servicios distintos.

Actualmente el proyecto define estas bases:

- `menu_db`
- `inventory_db`
- `order_db`
- `kitchen_db`
- `delivery_db`
- `notification_db`

Cada base se inicializa con su propio script SQL dentro de la carpeta `database/`.

## Bases configuradas en Docker Compose

`docker-compose.yml` levanta un contenedor PostgreSQL independiente por dominio.

| Servicio | Base | Puerto local | Usuario | Password | Script |
|---|---|---:|---|---|---|
| `menu-db` | `menu_db` | `5441` | `menu_user` | `menu123` | `database/menu-init.sql` |
| `inventory-db` | `inventory_db` | `5442` | `inventory_user` | `inventory123` | `database/inventory-init.sql` |
| `order-db` | `order_db` | `5443` | `order_user` | `order123` | `database/order-init.sql` |
| `kitchen-db` | `kitchen_db` | `5444` | `kitchen_user` | `kitchen123` | `database/kitchen-init.sql` |
| `delivery-db` | `delivery_db` | `5445` | `delivery_user` | `delivery123` | `database/delivery-init.sql` |
| `notification-db` | `notification_db` | `5446` | `notification_user` | `notification123` | `database/notification-init.sql` |

## Convención de conexión

### Desde la máquina local

Se usa `localhost` y el puerto publicado por Docker Compose.

Ejemplo:

```text
jdbc:postgresql://localhost:5443/order_db
```

### Desde otro contenedor dentro de Docker Compose

Se usa el nombre del servicio de base de datos y el puerto interno `5432`.

Ejemplo:

```text
jdbc:postgresql://order-db:5432/order_db
```

## menu_db

Script:

- [menu-init.sql](../database/menu-init.sql)

Responsabilidad:

- almacenar el catálogo base de productos del menú.

### Tabla `productos`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador del producto |
| `nombre` | `VARCHAR(120)` | `NOT NULL` | Nombre del producto |
| `descripcion` | `VARCHAR(500)` | nullable | Descripción del producto |
| `categoria` | `VARCHAR(80)` | `NOT NULL` | Categoría del producto |
| `disponible` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Disponibilidad para venta |
| `activo` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Estado lógico del producto |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Fecha de actualización |

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos (activo);
CREATE INDEX IF NOT EXISTS idx_productos_disponible_activo ON productos (disponible, activo);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_activo ON productos (categoria, activo);
```

Dato inicial:

- inserta `Pollo Frito` si no existe conflicto.

## inventory_db

Script:

- [inventory-init.sql](../database/inventory-init.sql)

Responsabilidad:

- almacenar existencias y reservas por producto.

### Tabla `inventory`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador interno |
| `product_id` | `BIGINT` | `UNIQUE`, `NOT NULL` | Referencia lógica al producto |
| `quantity` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Stock disponible |
| `reserved` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Stock reservado |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de actualización |

Dato inicial:

- inserta un registro base para `product_id = 1` con `quantity = 100` y `reserved = 0`.

## order_db

Script:

- [order-init.sql](../database/order-init.sql)

Responsabilidad:

- almacenar pedidos y eventos de salida del patrón outbox.

### Tabla `orders`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `SERIAL` | Primary key | Identificador del pedido |
| `idempotency_key` | `VARCHAR(150)` | `UNIQUE`, `NOT NULL` | Clave de idempotencia |
| `product_id` | `INT` | `NOT NULL` | Referencia lógica al producto |
| `quantity` | `INT` | `NOT NULL`, `CHECK (quantity > 0)` | Cantidad solicitada |
| `status` | `VARCHAR(50)` | `NOT NULL` | Estado actual del pedido |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Fecha de creación |

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
```

### Tabla `outbox_events`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `SERIAL` | Primary key | Identificador del evento |
| `aggregate_type` | `VARCHAR(100)` | `NOT NULL` | Tipo de agregado |
| `aggregate_id` | `INT` | `NOT NULL` | ID del agregado relacionado |
| `event_type` | `VARCHAR(100)` | `NOT NULL` | Tipo de evento |
| `payload` | `TEXT` | `NOT NULL` | Contenido del evento |
| `processed` | `BOOLEAN` | `DEFAULT FALSE` | Indicador de procesamiento |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Fecha de creación |

Índice:

```sql
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox_events(processed);
```

## kitchen_db

Script:

- [kitchen-init.sql](../database/kitchen-init.sql)

Responsabilidad:

- almacenar órdenes de cocina y su estado de preparación.

### Tabla `kitchen_orders`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador interno |
| `order_id` | `BIGINT` | `UNIQUE`, `NOT NULL` | Referencia lógica al pedido |
| `status` | `VARCHAR(50)` | `NOT NULL`, `CHECK (...)` | Estado de cocina |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de creación |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de actualización |
| `started_at` | `TIMESTAMP` | nullable | Inicio de preparación |
| `ready_at` | `TIMESTAMP` | nullable | Momento en que queda lista |

Estados permitidos:

- `PENDING`
- `PREPARING`
- `READY`
- `CANCELLED`

## delivery_db

Script:

- [delivery-init.sql](../database/delivery-init.sql)

Responsabilidad:

- almacenar entregas y su historial de cambios de estado.

### Tabla `delivery_orders`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador de la entrega |
| `order_id` | `BIGINT` | `UNIQUE`, `NOT NULL` | Referencia lógica al pedido |
| `status` | `VARCHAR(50)` | `NOT NULL`, `CHECK (...)` | Estado actual de la entrega |
| `assigned_driver_id` | `BIGINT` | nullable | Repartidor asignado |
| `delivery_address` | `VARCHAR(500)` | `NOT NULL` | Dirección de entrega |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de creación |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha de actualización |
| `assigned_at` | `TIMESTAMP` | nullable | Momento de asignación |
| `picked_up_at` | `TIMESTAMP` | nullable | Momento de recogida |
| `in_transit_at` | `TIMESTAMP` | nullable | Momento de salida a entrega |
| `delivered_at` | `TIMESTAMP` | nullable | Momento de entrega completada |
| `failed_at` | `TIMESTAMP` | nullable | Momento de fallo |
| `cancelled_at` | `TIMESTAMP` | nullable | Momento de cancelación |
| `cancel_reason` | `VARCHAR(255)` | nullable | Motivo de cancelación |
| `failure_reason` | `VARCHAR(255)` | nullable | Motivo de fallo |
| `version` | `BIGINT` | `NOT NULL`, `DEFAULT 0` | Control de concurrencia optimista |

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status
ON delivery_orders(status);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_assigned_driver_id
ON delivery_orders(assigned_driver_id);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at
ON delivery_orders(created_at);
```

Estados permitidos:

- `PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

### Tabla `delivery_status_history`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador del registro |
| `delivery_order_id` | `BIGINT` | `NOT NULL`, foreign key | Entrega asociada |
| `previous_status` | `VARCHAR(50)` | nullable | Estado anterior |
| `new_status` | `VARCHAR(50)` | `NOT NULL` | Nuevo estado |
| `reason` | `VARCHAR(255)` | nullable | Motivo del cambio |
| `changed_by` | `VARCHAR(100)` | nullable | Actor que hizo el cambio |
| `changed_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Fecha del cambio |

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_delivery_status_history_order_id
ON delivery_status_history(delivery_order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_changed_at
ON delivery_status_history(changed_at);
```

## notification_db

Script:

- [notification-init.sql](../database/notification-init.sql)

Responsabilidad:

- almacenar notificaciones emitidas por el sistema.

### Tabla `notifications`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Identificador de la notificación |
| `order_id` | `BIGINT` | `NOT NULL` | Referencia lógica al pedido |
| `channel` | `VARCHAR(30)` | `NOT NULL` | Canal de envío |
| `recipient` | `VARCHAR(150)` | `NOT NULL` | Destinatario |
| `message` | `TEXT` | `NOT NULL` | Contenido del mensaje |
| `status` | `VARCHAR(30)` | `NOT NULL`, `DEFAULT 'PENDING'` | Estado de la notificación |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación |

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_notifications_order_id
    ON notifications (order_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications (created_at);
```

## Relaciones lógicas entre bases

La arquitectura usa bases separadas por microservicio, así que no existen foreign keys entre bases distintas.

Relaciones lógicas actuales:

- `inventory.product_id` apunta lógicamente a productos de `menu_db`
- `orders.product_id` apunta lógicamente a productos del menú o inventario
- `kitchen_orders.order_id` apunta lógicamente a pedidos de `order_db`
- `delivery_orders.order_id` apunta lógicamente a pedidos de `order_db`
- `notifications.order_id` apunta lógicamente a pedidos de `order_db`
- `outbox_events.aggregate_id` apunta lógicamente a `orders.id`

Estas relaciones son lógicas a nivel de dominio, no restricciones físicas entre bases.

## Estado actual

El proyecto ya tiene definidas e inicializadas las seis bases de datos de dominio dentro de `docker-compose.yml`.

Estado observable hoy:

- `menu_db`, `inventory_db`, `order_db`, `kitchen_db`, `delivery_db` y `notification_db` tienen scripts SQL propios
- `order-service`, `kitchen-service` y `delivery-service` ya tienen base documentada e integrada en código
- `menu-service`, `inventory-service` y `notification-service` también tienen su base preparada a nivel de esquema

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [menu-init.sql](../database/menu-init.sql)
- [inventory-init.sql](../database/inventory-init.sql)
- [order-init.sql](../database/order-init.sql)
- [kitchen-init.sql](../database/kitchen-init.sql)
- [delivery-init.sql](../database/delivery-init.sql)
- [notification-init.sql](../database/notification-init.sql)
