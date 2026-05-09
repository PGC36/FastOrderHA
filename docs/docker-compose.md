# Docker Compose

## Resumen

El archivo principal de orquestacion local del proyecto es:

- [docker-compose.yml](../docker-compose.yml)

Su proposito es levantar todo el entorno de integracion local de FastOrder HA:

- una base de datos PostgreSQL general
- microservicios de aplicacion
- `api-gateway`
- `redis`
- `rabbitmq`
- red compartida
- volumen persistente

## Servicios definidos

### Base de datos PostgreSQL

| Servicio | Base | Puerto local | Script |
|---|---|---:|---|
| `fastorder-db` | `fastorder_db` | `5440` | `database/fastorder-init.sql` |

Todos los microservicios usan esta misma base.

### Infraestructura compartida

| Servicio | Puerto |
|---|---:|
| `redis` | `6379` |
| `rabbitmq` | `5672` |
| `rabbitmq` management | `15672` |

### Servicios de aplicacion

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

Todos los servicios se conectan a:

- `fastorder-network`

Ejemplos de resolucion interna:

```text
jdbc:postgresql://fastorder-db:5432/fastorder_db
http://inventory-service:8083/inventory
http://kitchen-service:8084/kitchen/orders
http://delivery-service:8085/deliveries
http://notification-service:8086/notifications
```

## Volumen persistente

El archivo define un solo volumen:

- `fastorder_db_data`

Los datos de PostgreSQL persisten entre reinicios. El script `database/fastorder-init.sql` se ejecuta cuando el volumen se crea por primera vez.

## Variables de entorno principales

### PostgreSQL

- `POSTGRES_DB=fastorder_db`
- `POSTGRES_USER=fastorder_user`
- `POSTGRES_PASSWORD=fastorder123`

### Servicios Spring Boot

- `SPRING_DATASOURCE_URL=jdbc:postgresql://fastorder-db:5432/fastorder_db`
- `SPRING_DATASOURCE_USERNAME=fastorder_user`
- `SPRING_DATASOURCE_PASSWORD=fastorder123`

`menu-service` conserva sus variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`, pero tambien apunta a `fastorder-db` y RabbitMQ.

## Dependencias entre servicios

- `menu-service` depende de `fastorder-db` y `rabbitmq`
- `inventory-service` depende de `fastorder-db` y `rabbitmq`
- `order-service` depende de `fastorder-db`, `rabbitmq`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service`
- `kitchen-service` depende de `fastorder-db` y `rabbitmq`
- `delivery-service` depende de `fastorder-db` y `rabbitmq`
- `notification-service` depende de `fastorder-db` y `rabbitmq`
- `api-gateway` depende de `redis`, `rabbitmq`, `menu-service`, `inventory-service` y `notification-service`

Nota:

- `depends_on` ayuda con el orden basico de arranque, pero no garantiza que la aplicacion ya este lista funcionalmente.

## Convencion de acceso local

Desde la maquina host se usan puertos publicados:

```text
http://localhost:8080
http://localhost:8082
http://localhost:8084
http://localhost:8085
jdbc:postgresql://localhost:5440/fastorder_db
```

## Comandos utiles

Levantar todo el stack:

```bash
docker compose up --build
```

Levantar en segundo plano:

```bash
docker compose up --build -d
```

Ver logs de todo el entorno:

```bash
docker compose logs
```

Ver logs de un servicio especifico:

```bash
docker compose logs order-service
docker compose logs kitchen-service
docker compose logs delivery-service
```

Detener el stack:

```bash
docker compose down
```

Detener y eliminar volumenes:

```bash
docker compose down -v
```

Advertencia:

- `docker compose down -v` elimina los datos persistidos de PostgreSQL.

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [database.md](./database.md)
- [deployment.md](./deployment.md)
- [arquitectura.md](./arquitectura.md)
