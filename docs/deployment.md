# Deployment

## Resumen

FastOrder HA se despliega localmente con Docker Compose. El archivo principal de despliegue es:

- [docker-compose.yml](../docker-compose.yml)

Ese archivo define:

- una base de datos PostgreSQL general
- servicios de aplicacion
- `api-gateway`
- `redis`
- `rabbitmq`
- red compartida interna
- volumen persistente para PostgreSQL

## Requisitos previos

- Docker
- Docker Compose

Verificacion rapida:

```bash
docker --version
docker compose version
```

## Componentes que levanta Compose

### Base de datos

| Servicio | Base | Puerto local |
|---|---|---:|
| `fastorder-db` | `fastorder_db` | `5440` |

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

## Red de despliegue

Todos los servicios se conectan a:

- `fastorder-network`

Esto permite que los contenedores se resuelvan entre si por nombre de servicio.

Ejemplos:

- los microservicios se conectan a `fastorder-db`
- `api-gateway` se conecta a `menu-service`, `order-service`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service`

## Volumen persistente

PostgreSQL usa:

- `fastorder_db_data`

Esto implica:

- los datos persisten entre reinicios de contenedores
- `database/fastorder-init.sql` se ejecuta solo cuando el volumen se crea por primera vez

## Como levantar el entorno

Desde la raiz del proyecto:

```bash
docker compose up --build
```

En segundo plano:

```bash
docker compose up --build -d
```

## Como detener el entorno

```bash
docker compose down
```

Para detener y eliminar volumenes:

```bash
docker compose down -v
```

Advertencia:

- `docker compose down -v` elimina la base `fastorder_db` persistida en el volumen.

## Verificacion del despliegue

Ver contenedores activos:

```bash
docker ps
```

Ver logs:

```bash
docker compose logs
docker compose logs order-service
docker compose logs kitchen-service
docker compose logs delivery-service
```

Ver estado del gateway:

```bash
curl http://localhost:8080/actuator/health
```

Ver estado de servicios que exponen Actuator:

```bash
curl http://localhost:8084/actuator/health
curl http://localhost:8085/actuator/health
```

## Acceso a servicios desde el gateway

Rutas expuestas:

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

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SPRING_RABBITMQ_HOST`
- `SPRING_RABBITMQ_PORT`
- `INVENTORY_SERVICE_URL`
- `KITCHEN_SERVICE_URL`
- `DELIVERY_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [arquitectura.md](./arquitectura.md)
- [database.md](./database.md)
