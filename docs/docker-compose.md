# Docker Compose

## Resumen

El archivo principal de orquestacion local es [docker-compose.yml](../docker-compose.yml). Levanta el entorno completo de FastOrder HA:

- PostgreSQL general.
- microservicios Spring Boot.
- API Gateway.
- RabbitMQ con Management y metricas Prometheus.
- Redis para rate limiting del API Gateway.
- Prometheus.
- Grafana.
- cAdvisor.
- red compartida `fastorder-network`.
- volumen persistente para PostgreSQL.

## Servicios definidos

### Base de datos

| Servicio | Base | Puerto local | Script |
|---|---|---:|---|
| `fastorder-db` | `fastorder_db` | `5440` | `database/fastorder-init.sql` |

Todos los microservicios usan esta misma base fisica y separan datos por tablas de dominio.

### Infraestructura

| Servicio | Uso | Puerto local |
|---|---|---:|
| `redis` | Rate limiting del API Gateway | `6379` |
| `rabbitmq` | Broker AMQP | `5672` |
| `rabbitmq` management | Consola web RabbitMQ | `15672` |
| `rabbitmq` prometheus | Metricas RabbitMQ | `15692` |
| `prometheus` | Recoleccion de metricas | `9090` |
| `grafana` | Dashboards | `3000` |
| `cadvisor` | CPU y memoria de contenedores | `8087` |

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

## RabbitMQ

RabbitMQ usa:

```text
host interno: rabbitmq
puerto AMQP: 5672
usuario: guest
password: guest
management: http://localhost:15672
metricas: http://localhost:15692/metrics
```

Los servicios dentro de Docker no deben usar `localhost` para RabbitMQ. Deben usar el host `rabbitmq`.

Variables esperadas:

```text
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=guest
SPRING_RABBITMQ_PASSWORD=guest
```

El flujo de pedidos usa RabbitMQ de forma asincrona con:

- colas durables;
- reintentos con backoff en los listeners;
- `default-requeue-rejected=false` para evitar ciclos infinitos;
- DLQ por cola con sufijo `.dlq`;
- publisher confirms en `order-service` para marcar eventos outbox como procesados solo cuando RabbitMQ confirma el publish.

Si ya existian colas creadas antes de esta configuracion, RabbitMQ puede rechazar el arranque por cambio de argumentos de cola. En ambiente local se resuelve eliminando las colas desde Management o recreando el entorno con:

```bash
docker compose down -v
docker compose up --build -d
```

Advertencia: ese comando elimina tambien los volumenes persistidos.

## Redis

Redis se usa desde `api-gateway` para limitar peticiones por cliente antes de enviarlas a los microservicios.

Variables del gateway:

```text
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_TIMEOUT=500ms
SPRING_DATA_REDIS_CONNECT_TIMEOUT=500ms
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_FAIL_OPEN=true
API_RATE_LIMIT_CAPACITY=100000
API_RATE_LIMIT_WINDOW_SECONDS=60
```

El limite esta configurado alto para permitir la prueba de 50,000 peticiones. Para demostrar rechazo por exceso de trafico, se puede bajar `API_RATE_LIMIT_CAPACITY` temporalmente y recrear el gateway.

## Observabilidad

Prometheus recolecta:

- Actuator/Micrometer de servicios Spring Boot.
- RabbitMQ global.
- RabbitMQ per-object para colas por nombre.
- cAdvisor para CPU y memoria de contenedores.

Grafana carga dashboards desde:

```text
monitoring/grafana/
```

## Red compartida

Todos los contenedores usan:

```text
fastorder-network
```

Ejemplos internos:

```text
jdbc:postgresql://fastorder-db:5432/fastorder_db
http://inventory-service:8083
http://kitchen-service:8084
http://delivery-service:8085
amqp://rabbitmq:5672
```

## Variables principales

PostgreSQL:

```text
POSTGRES_DB=fastorder_db
POSTGRES_USER=fastorder_user
POSTGRES_PASSWORD=fastorder123
```

Spring Boot:

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://fastorder-db:5432/fastorder_db
SPRING_DATASOURCE_USERNAME=fastorder_user
SPRING_DATASOURCE_PASSWORD=fastorder123
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=guest
SPRING_RABBITMQ_PASSWORD=guest
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_TIMEOUT=500ms
SPRING_DATA_REDIS_CONNECT_TIMEOUT=500ms
```

Workers RabbitMQ:

```text
SPRING_RABBITMQ_LISTENER_SIMPLE_PREFETCH=20
SPRING_RABBITMQ_LISTENER_SIMPLE_CONCURRENCY=8
SPRING_RABBITMQ_LISTENER_SIMPLE_MAX_CONCURRENCY=16
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=3
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=1000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=2
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=10000
ORDER_PROCESSING_MODE=event
```

`ORDER_PROCESSING_MODE=event` mantiene activo el flujo por outbox + RabbitMQ. El modo `internal-worker` queda reservado para pruebas puntuales y no debe usarse al mismo tiempo que el flujo por eventos.

Rate limiting:

```text
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_FAIL_OPEN=true
API_RATE_LIMIT_CAPACITY=100000
API_RATE_LIMIT_WINDOW_SECONDS=60
```

## Volumen persistente

PostgreSQL usa:

```text
fastorder_db_data
```

`database/fastorder-init.sql` se ejecuta cuando el volumen se crea por primera vez.

## Comandos utiles

Levantar todo:

```bash
docker compose up --build -d
```

Levantar un servicio especifico:

```bash
docker compose up --build -d notification-service
```

Ver logs:

```bash
docker compose logs -f order-service
docker compose logs -f inventory-service
docker compose logs -f kitchen-service
docker compose logs -f delivery-service
docker compose logs -f notification-service
```

Detener:

```bash
docker compose down
```

Detener eliminando volumenes:

```bash
docker compose down -v
```

Advertencia: `docker compose down -v` elimina los datos persistidos de PostgreSQL.

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [deployment.md](./deployment.md)
- [database.md](./database.md)
- [arquitectura.md](./arquitectura.md)
