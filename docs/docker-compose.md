# Docker Compose

## Resumen

El archivo principal de orquestación local del proyecto es:

- [docker-compose.yml](../docker-compose.yml)

Su propósito es levantar todo el entorno de integración local de FastOrder HA:

- bases de datos PostgreSQL por dominio
- microservicios de aplicación
- `api-gateway`
- `redis`
- `rabbitmq`
- red compartida
- volúmenes persistentes

## Rol dentro del proyecto

`docker-compose.yml` permite:

- levantar el stack completo en desarrollo local
- conectar servicios entre sí por nombre de contenedor
- inicializar cada base con su script SQL
- probar la integración entre gateway, servicios y bases

No representa todavía un despliegue productivo.

## Estructura general del archivo

El archivo actual define estas secciones principales:

- `services`
- `networks`
- `volumes`

## Servicios definidos actualmente

### Bases de datos PostgreSQL

| Servicio | Base | Puerto local | Script |
|---|---|---:|---|
| `menu-db` | `menu_db` | `5441` | `database/menu-init.sql` |
| `inventory-db` | `inventory_db` | `5442` | `database/inventory-init.sql` |
| `order-db` | `order_db` | `5443` | `database/order-init.sql` |
| `kitchen-db` | `kitchen_db` | `5444` | `database/kitchen-init.sql` |
| `delivery-db` | `delivery_db` | `5445` | `database/delivery-init.sql` |
| `notification-db` | `notification_db` | `5446` | `database/notification-init.sql` |

### Infraestructura compartida

| Servicio | Puerto |
|---|---:|
| `redis` | `6379` |
| `rabbitmq` | `5672` |
| `rabbitmq` management | `15672` |

### Servicios de aplicación

| Servicio | Puerto |
|---|---:|
| `api-gateway` | `8080` |
| `menu-service` | `8081` |
| `order-service` | `8082` |
| `inventory-service` | `8083` |
| `kitchen-service` | `8084` |
| `delivery-service` | `8085` |
| `notification-service` | `8086` |

## Red compartida

Todos los servicios definidos se conectan a:

- `fastorder-network`

Función de esta red:

- permitir comunicación interna entre contenedores
- resolver servicios por nombre

Ejemplos:

- `order-service` se conecta a `order-db`
- `kitchen-service` se conecta a `kitchen-db`
- `delivery-service` se conecta a `delivery-db`
- `api-gateway` se conecta a `menu-service`, `order-service`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service`

## Volúmenes persistentes

El archivo define estos volúmenes:

- `menu_db_data`
- `inventory_db_data`
- `order_db_data`
- `kitchen_db_data`
- `delivery_db_data`
- `notification_db_data`

Función:

- persistir datos de PostgreSQL entre reinicios

Implicación práctica:

- los scripts `database/*-init.sql` se ejecutan en la creación inicial del volumen
- si se elimina el volumen, la base se vuelve a inicializar desde el script

## Inicialización de bases

Cada servicio PostgreSQL monta su SQL en:

```text
/docker-entrypoint-initdb.d/init.sql
```

Scripts usados actualmente:

- `database/menu-init.sql`
- `database/inventory-init.sql`
- `database/order-init.sql`
- `database/kitchen-init.sql`
- `database/delivery-init.sql`
- `database/notification-init.sql`

Más detalle:

- ver [database.md](./database.md)

## Variables de entorno visibles

El archivo ya muestra estas convenciones:

### Bases PostgreSQL

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

### Servicios Spring Boot

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

### RabbitMQ

- `SPRING_RABBITMQ_HOST`
- `SPRING_RABBITMQ_PORT`
- `SPRING_RABBITMQ_USERNAME`
- `SPRING_RABBITMQ_PASSWORD`

### URLs internas de integración

`order-service` ya usa:

- `INVENTORY_SERVICE_URL`
- `KITCHEN_SERVICE_URL`
- `DELIVERY_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`

## Dependencias entre servicios

El archivo ya expresa dependencias con `depends_on`.

Relaciones visibles:

- `menu-service` depende de `menu-db`
- `inventory-service` depende de `inventory-db` y `rabbitmq`
- `order-service` depende de `order-db`, `rabbitmq`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service`
- `kitchen-service` depende de `kitchen-db` y `rabbitmq`
- `delivery-service` depende de `delivery-db` y `rabbitmq`
- `notification-service` depende de `notification-db` y `rabbitmq`
- `api-gateway` depende de `redis`, `rabbitmq`, `menu-service`, `inventory-service` y `notification-service`

Nota:

- `depends_on` ayuda con el orden básico de arranque
- no garantiza que la aplicación ya esté lista funcionalmente

## Convención de acceso interno

Dentro de Docker Compose, los servicios usan nombres internos.

Ejemplos:

```text
jdbc:postgresql://order-db:5432/order_db
jdbc:postgresql://kitchen-db:5432/kitchen_db
jdbc:postgresql://delivery-db:5432/delivery_db
http://inventory-service:8083/inventory
http://kitchen-service:8084/kitchen/orders
http://delivery-service:8085/deliveries
http://notification-service:8086/notifications
```

## Convención de acceso local

Desde la máquina host se usan puertos publicados.

Ejemplos:

```text
http://localhost:8080
http://localhost:8082
http://localhost:8084
http://localhost:8085
jdbc:postgresql://localhost:5443/order_db
jdbc:postgresql://localhost:5444/kitchen_db
jdbc:postgresql://localhost:5445/delivery_db
```

## Comandos útiles

Levantar todo el stack:

```bash
docker compose up --build
```

Levantar en segundo plano:

```bash
docker compose up --build -d
```

Ver contenedores activos:

```bash
docker ps
```

Ver logs de todo el entorno:

```bash
docker compose logs
```

Ver logs de un servicio específico:

```bash
docker compose logs order-service
docker compose logs kitchen-service
docker compose logs delivery-service
```

Detener el stack:

```bash
docker compose down
```

Detener y eliminar volúmenes:

```bash
docker compose down -v
```

Advertencia:

- `docker compose down -v` elimina los datos persistidos de PostgreSQL

## Relación con el gateway

El despliegue actual ya deja `api-gateway` como punto de entrada HTTP externo.

Rutas visibles hoy:

- `/api/menu/**`
- `/api/orders`
- `/api/orders/**`
- `/api/inventory/**`
- `/api/kitchen/**`
- `/api/delivery`
- `/api/delivery/**`
- `/api/notifications`
- `/api/notifications/**`

## Relación con observabilidad

El `docker-compose.yml` actual no define servicios de Prometheus ni Grafana, aunque el repositorio sí contiene:

- `monitoring/prometheus.yml`
- `monitoring/grafana/`

Además:

- `api-gateway`, `kitchen-service` y `delivery-service` ya exponen métricas Prometheus desde la aplicación

## Limitaciones actuales del Compose

En el estado actual del archivo:

- se usan `container_name` fijos
- no hay healthchecks definidos
- no hay estrategia de réplicas
- no se describe despliegue productivo
- la orquestación está orientada a desarrollo e integración local

## Estado actual

El `docker-compose.yml` ya permite levantar un entorno local completo con:

- gateway
- microservicios
- bases separadas por dominio
- Redis
- RabbitMQ

Eso lo convierte en la pieza central del entorno local de desarrollo del proyecto.

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [deployment.md](./deployment.md)
- [arquitectura.md](./arquitectura.md)
- [database.md](./database.md)
