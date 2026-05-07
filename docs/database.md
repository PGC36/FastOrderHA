# Base de datos

## Descripcion general

FastOrder HA esta planteado como una arquitectura de microservicios con una base de datos separada por microservicio. Este enfoque evita que los servicios compartan directamente el mismo esquema y reduce el acoplamiento entre dominios.

Actualmente, la base implementada y utilizada por el microservicio desarrollado es `order_db`, correspondiente a `order-service`.

## Bases configuradas en Docker Compose

`docker-compose.yml` define contenedores PostgreSQL para varios dominios. Sin embargo, no todos los microservicios de aplicacion estan implementados todavia.

| Servicio de base de datos | Base | Puerto local | Estado |
| --- | --- | --- | --- |
| `menu-db` | `menu_db` | `5441` | Base configurada; aplicacion pendiente |
| `inventory-db` | `inventory_db` | `5442` | Base configurada; aplicacion pendiente |
| `order-db` | `order_db` | `5443` | Implementada y usada por `order-service` |
| `kitchen-db` | `kitchen_db` | `5444` | Base configurada; aplicacion pendiente |
| `delivery-db` | `delivery_db` | `5445` | Base configurada; aplicacion pendiente |
| `notification-db` | `notification_db` | `5446` | Base configurada; aplicacion pendiente |

## order_db

`order_db` es la base propia de `order-service`. Se inicializa con el archivo:

```text
database/order-init.sql
```

En Docker Compose, este archivo se monta en:

```text
/docker-entrypoint-initdb.d/init.sql
```

PostgreSQL ejecuta ese script durante la inicializacion del contenedor cuando el volumen de datos se crea por primera vez.

## Datos de conexion

Para conectarse desde herramientas como pgAdmin o DBeaver:

| Campo | Valor |
| --- | --- |
| Host | `localhost` |
| Port | `5443` |
| Database | `order_db` |
| User | `order_user` |
| Password | `order123` |

Dentro de Docker, `order-service` se conecta usando el nombre del servicio de Compose:

```text
jdbc:postgresql://order-db:5432/order_db
```

Desde la maquina local, la conexion usa el puerto publicado:

```text
jdbc:postgresql://localhost:5443/order_db
```

## Tabla orders

La tabla `orders` almacena pedidos creados por `order-service`.

| Columna | Tipo | Restricciones | Descripcion |
| --- | --- | --- | --- |
| `id` | `SERIAL` | Primary key | Identificador del pedido |
| `idempotency_key` | `VARCHAR(150)` | `UNIQUE`, `NOT NULL` | Clave para evitar pedidos duplicados |
| `product_id` | `INT` | `NOT NULL` | Identificador logico del producto solicitado |
| `quantity` | `INT` | `NOT NULL`, `CHECK (quantity > 0)` | Cantidad solicitada |
| `status` | `VARCHAR(50)` | `NOT NULL` | Estado actual del pedido |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Fecha de creacion |

Indices:

```sql
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
```

## Tabla outbox_events

La tabla `outbox_events` guarda eventos generados por `order-service` para habilitar integraciones asincronas.

| Columna | Tipo | Restricciones | Descripcion |
| --- | --- | --- | --- |
| `id` | `SERIAL` | Primary key | Identificador del evento |
| `aggregate_type` | `VARCHAR(100)` | `NOT NULL` | Tipo de agregado, actualmente `ORDER` |
| `aggregate_id` | `INT` | `NOT NULL` | ID del pedido asociado |
| `event_type` | `VARCHAR(100)` | `NOT NULL` | Tipo de evento, actualmente `order.created` |
| `payload` | `TEXT` | `NOT NULL` | Contenido JSON del evento |
| `processed` | `BOOLEAN` | `DEFAULT FALSE` | Indica si el evento fue procesado |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Fecha de creacion del evento |

Indice:

```sql
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox_events(processed);
```

## Relacion logica entre servicios

La arquitectura usa bases separadas por microservicio, por lo que no hay foreign keys entre bases de datos distintas.

Relaciones logicas actuales:

- `orders.product_id` representa el producto solicitado y se relacionara logicamente con datos de `menu-service` o `inventory-service` en fases posteriores.
- `outbox_events.aggregate_id` contiene el `order_id` del pedido que genero el evento.
- Los eventos `order.created` podran ser consumidos por otros servicios cuando se implemente el procesamiento del outbox.

Estas relaciones son logicas, no restricciones fisicas de PostgreSQL entre bases.

## Consultas utiles

Listar pedidos:

```sql
SELECT * FROM orders;
```

Listar eventos outbox:

```sql
SELECT * FROM outbox_events;
```

Ver eventos pendientes:

```sql
SELECT * FROM outbox_events WHERE processed = false;
```

Buscar pedido por clave de idempotencia:

```sql
SELECT * FROM orders WHERE idempotency_key = 'pedido-cliente-001';
```

## Estado actual

`order_db` esta implementada para el flujo inicial de pedidos. El esquema actual soporta creacion y consulta de pedidos, idempotencia por `idempotency_key` y registro de eventos mediante Outbox Pattern.

No existe integracion real con bases de otros microservicios ni foreign keys entre servicios. Las integraciones con inventario, cocina, delivery o notificaciones quedan pendientes para fases posteriores.
