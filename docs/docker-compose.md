# Docker Compose

## Resumen

El archivo principal de orquestacion local es [docker-compose.yml](../docker-compose.yml). Levanta el entorno completo de FastOrder HA:

- PostgreSQL primary/standby con Pgpool como endpoint unico.
- microservicios Spring Boot.
- API Gateway.
- RabbitMQ con Management y metricas Prometheus.
- Redis para rate limiting del API Gateway.
- Prometheus.
- Grafana.
- cAdvisor.
- red compartida `fastorder-network`.
- volumenes persistentes para PostgreSQL primario y standby.

## Servicios definidos

### Base de datos

| Servicio | Funcion | Puerto local | Script |
|---|---|---:|---|
| `fastorder-db` | Pgpool / endpoint unico | `5440` | N/A |
| `fastorder-db-0` | PostgreSQL primario con repmgr | interno | `database/fastorder-init.sql` |
| `fastorder-db-1` | PostgreSQL standby con repmgr | interno | replica desde primario |
| `db-recovery` | Watcher de recuperacion de BD y Pgpool | interno | N/A |

Todos los microservicios usan el endpoint `fastorder-db:5432`. Pgpool se encarga de enrutar hacia el nodo PostgreSQL primario activo y de monitorear la replica. El balanceo de lecturas queda desactivado para evitar lecturas inconsistentes durante la demo. Pgpool queda configurado con `PGPOOL_NUM_INIT_CHILDREN=120`, `PGPOOL_MAX_POOL=1` y `PGPOOL_FAILOVER_ON_BACKEND_ERROR=yes`; ademas, los pools Hikari de los microservicios se limitan desde Docker Compose para evitar saturar las conexiones de PostgreSQL durante pruebas de carga.

Cuando el primario cae, repmgr promueve el standby. Al volver el nodo caido, este puede reincorporarse como standby. Por eso, despues de una prueba de caos, el primario activo puede ser `fastorder-db-1` y `fastorder-db-0` puede quedar como replica.

`db-recovery` ejecuta Docker CLI dentro de un contenedor y monta `/var/run/docker.sock`. Su funcion es observar la capa de BD y los microservicios principales; si algun contenedor queda apagado por una prueba con `docker kill`, lo arranca con `docker start`. Si Pgpool queda `unhealthy` despues del failover, reinicia `fastorder-db` para recuperar el endpoint unico.

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

Para soportar failover de PostgreSQL durante una prueba de caos, los consumidores se ejecutan con reintentos mas largos desde Docker Compose:

```text
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

Esto evita que un corte transitorio de base de datos mande mensajes validos a DLQ mientras repmgr promueve la replica y Pgpool cambia el primario activo.

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
POSTGRESQL_DATABASE=fastorder_db
POSTGRESQL_USERNAME=fastorder_user
POSTGRESQL_PASSWORD=fastorder123
POSTGRESQL_POSTGRES_PASSWORD=fastorder123
REPMGR_USERNAME=repmgr
REPMGR_PASSWORD=repmgr123
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
fastorder_db_0_data
fastorder_db_1_data
```

`database/fastorder-init.sql` se ejecuta en el nodo primario cuando el volumen se crea por primera vez. La replica standby sincroniza los datos desde el primario mediante repmgr.

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
