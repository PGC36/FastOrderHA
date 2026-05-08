# Deployment

## Resumen

FastOrder HA se despliega localmente con Docker Compose. El archivo principal de despliegue es:

- [docker-compose.yml](../docker-compose.yml)

Ese archivo define:

- bases de datos PostgreSQL por microservicio
- servicios de aplicación
- `api-gateway`
- `redis`
- `rabbitmq`
- red compartida interna
- volúmenes persistentes por base de datos

## Requisitos previos

Para levantar el entorno local se necesita:

- Docker
- Docker Compose

Verificación rápida:

```bash
docker --version
docker compose version
```

## Componentes que levanta Compose

### Bases de datos

| Servicio | Base | Puerto local |
|---|---|---:|
| `menu-db` | `menu_db` | `5441` |
| `inventory-db` | `inventory_db` | `5442` |
| `order-db` | `order_db` | `5443` |
| `kitchen-db` | `kitchen_db` | `5444` |
| `delivery-db` | `delivery_db` | `5445` |
| `notification-db` | `notification_db` | `5446` |

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

## Red de despliegue

Todos los servicios se conectan a la red:

- `fastorder-network`

Eso permite que los contenedores se resuelvan entre sí por nombre de servicio.

Ejemplos:

- `order-service` puede conectarse a `order-db`
- `kitchen-service` puede conectarse a `kitchen-db`
- `delivery-service` puede conectarse a `delivery-db`
- `api-gateway` puede conectarse a `menu-service`, `order-service`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service`

## Volúmenes persistentes

Las bases PostgreSQL usan volúmenes dedicados:

- `menu_db_data`
- `inventory_db_data`
- `order_db_data`
- `kitchen_db_data`
- `delivery_db_data`
- `notification_db_data`

Esto implica:

- los datos persisten entre reinicios de contenedores
- los scripts SQL de inicialización se ejecutan solo cuando el volumen se crea por primera vez

## Scripts de inicialización

Cada base monta su script SQL en:

```text
/docker-entrypoint-initdb.d/init.sql
```

Scripts actuales:

- `database/menu-init.sql`
- `database/inventory-init.sql`
- `database/order-init.sql`
- `database/kitchen-init.sql`
- `database/delivery-init.sql`
- `database/notification-init.sql`

Más detalle:

- ver [database.md](./database.md)

## Cómo levantar el entorno

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Si se quiere en segundo plano:

```bash
docker compose up --build -d
```

## Cómo detener el entorno

Para detener contenedores:

```bash
docker compose down
```

Para detener y eliminar volúmenes:

```bash
docker compose down -v
```

Advertencia:

- `docker compose down -v` elimina las bases de datos persistidas en los volúmenes

## Verificación del despliegue

### Ver contenedores activos

```bash
docker ps
```

### Ver logs de todo el entorno

```bash
docker compose logs
```

### Ver logs de un servicio específico

```bash
docker compose logs order-service
docker compose logs kitchen-service
docker compose logs delivery-service
```

### Ver estado del gateway

```bash
curl http://localhost:8080/actuator/health
```

### Ver estado de servicios que exponen Actuator

```bash
curl http://localhost:8084/actuator/health
curl http://localhost:8085/actuator/health
```

### Ver métricas Prometheus expuestas por servicios actuales

```bash
curl http://localhost:8084/actuator/prometheus
curl http://localhost:8085/actuator/prometheus
```

## Acceso a servicios desde el gateway

Actualmente el `api-gateway` expone rutas para:

- `/api/menu/**`
- `/api/orders`
- `/api/orders/**`
- `/api/inventory/**`
- `/api/kitchen/**`
- `/api/delivery`
- `/api/delivery/**`
- `/api/notifications`
- `/api/notifications/**`

Ejemplos:

```bash
curl http://localhost:8080/api/kitchen/orders
curl http://localhost:8080/api/delivery
curl http://localhost:8080/api/delivery/by-order/1
```

## Variables de entorno importantes

El despliegue actual usa variables de entorno dentro de Compose para definir conexiones internas entre servicios.

Ejemplos:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SPRING_RABBITMQ_HOST`
- `SPRING_RABBITMQ_PORT`
- `INVENTORY_SERVICE_URL`
- `KITCHEN_SERVICE_URL`
- `DELIVERY_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`

## Orden de dependencia visible

El archivo Compose ya refleja varias dependencias entre servicios:

- `menu-service` depende de `menu-db`
- `inventory-service` depende de `inventory-db` y `rabbitmq`
- `order-service` depende de `order-db`, `rabbitmq`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service`
- `kitchen-service` depende de `kitchen-db` y `rabbitmq`
- `delivery-service` depende de `delivery-db` y `rabbitmq`
- `notification-service` depende de `notification-db` y `rabbitmq`
- `api-gateway` depende de `redis`, `rabbitmq`, `menu-service`, `inventory-service` y `notification-service`

Nota:

- `depends_on` controla orden de arranque básico, pero no garantiza que un servicio ya esté listo funcionalmente para recibir tráfico.

## Consideraciones actuales del despliegue

El despliegue local actual muestra estas características:

- uso de `restart: unless-stopped`
- puertos publicados directamente al host
- `container_name` fijo en los servicios
- bases con volúmenes persistentes
- integración local pensada para desarrollo e integración manual

## Limitaciones del despliegue actual

En el estado actual del proyecto:

- no hay healthchecks definidos en `docker-compose.yml`
- no hay estrategia de réplicas dentro del Compose actual
- no está documentado un despliegue productivo
- Prometheus y Grafana existen en el repositorio, pero no aparecen definidos en este `docker-compose.yml`
- varios servicios todavía están evolucionando y no todos tienen el mismo nivel de madurez funcional

## Estado actual

Hoy el proyecto puede levantarse como un entorno local compuesto por:

- gateway
- microservicios
- PostgreSQL por dominio
- Redis
- RabbitMQ

Ese entorno sirve para:

- desarrollo local
- integración entre servicios
- pruebas manuales
- validación de conexiones, rutas y bases separadas

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [arquitectura.md](./arquitectura.md)
- [database.md](./database.md)
