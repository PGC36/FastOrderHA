# Deployment

## Resumen

FastOrder HA se despliega localmente con Docker Compose. El despliegue actual levanta microservicios, PostgreSQL primary/standby con Pgpool, RabbitMQ, Redis, Prometheus, Grafana, cAdvisor, backups automaticos y recuperacion operativa para contenedores y DLQ.

Archivo principal:

- [docker-compose.yml](../docker-compose.yml)

## Requisitos

- Docker.
- Docker Compose.

Verificacion:

```bash
docker --version
docker compose version
```

## Levantar el entorno

Desde la raiz del proyecto:

```bash
docker compose up --build -d
```

Ver contenedores:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f
```

## URLs locales

| Componente | URL |
|---|---|
| API Gateway | `http://localhost:8080` |
| RabbitMQ Management | `http://localhost:15672` |
| RabbitMQ metrics | `http://localhost:15692/metrics` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3000` |
| cAdvisor | `http://localhost:8087` |

Credenciales:

- RabbitMQ: `guest / guest`.
- Grafana: `admin / admin` en el primer acceso local.

## Componentes

| Servicio | Puerto | Funcion |
|---|---:|---|
| `api-gateway` | `8080` | Entrada HTTP y rate limiting |
| `menu-service` | `8081` | Menu |
| `order-service` | `8082` | Ordenes y Saga |
| `inventory-service` | `8083` | Stock |
| `kitchen-service` | `8084` | Cocina |
| `delivery-service` | `8085` | Entregas |
| `notification-service` | `8086` | Notificaciones |
| `fastorder-db` | `5440` | Pgpool / endpoint unico PostgreSQL |
| `fastorder-db-0` | interno | PostgreSQL primario |
| `fastorder-db-1` | interno | PostgreSQL replica |
| `db-recovery` | interno | Watcher de recuperacion de PostgreSQL/Pgpool y microservicios |
| `postgres-backup` | interno | Backups automaticos de PostgreSQL |
| `dlq-recovery` | interno | Reinyeccion automatica de mensajes desde DLQ |
| `rabbitmq` | `5672` | Broker |
| `redis` | `6379` | Rate limiting del gateway |
| `prometheus` | `9090` | Metricas |
| `grafana` | `3000` | Dashboards |
| `cadvisor` | `8087` | Contenedores |

## Health checks

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8081/actuator/health
curl http://localhost:8082/actuator/health
curl http://localhost:8083/actuator/health
curl http://localhost:8084/actuator/health
curl http://localhost:8085/actuator/health
curl http://localhost:8086/actuator/health
```

Verificar el endpoint de base de datos:

```bash
docker compose exec fastorder-db psql -h fastorder-db -U fastorder_user -d fastorder_db -c "select 1;"
```

Verificar roles de los nodos PostgreSQL:

```bash
docker compose exec fastorder-db-0 psql -U fastorder_user -d fastorder_db -c "select pg_is_in_recovery();"
docker compose exec fastorder-db-1 psql -U fastorder_user -d fastorder_db -c "select pg_is_in_recovery();"
```

`false` indica primario activo y `true` indica standby.

Antes de una prueba manual de failover, conviene identificar cual nodo esta activo porque despues de una promocion previa el primario puede ser `fastorder-db-0` o `fastorder-db-1`.

Prueba manual de failover de base de datos:

```bash
docker kill fastorder-db-0
docker compose ps fastorder-db fastorder-db-0 fastorder-db-1
docker compose exec fastorder-db-1 psql -U fastorder_user -d fastorder_db -c "select pg_is_in_recovery();"
```

Despues de la promocion, Pgpool mantiene el endpoint `fastorder-db:5432`. El nodo que queda con `pg_is_in_recovery() = false` es el primario activo. El contenedor `db-recovery` observa los nodos de BD, Pgpool y microservicios desde Docker; si un contenedor queda apagado por `docker kill`, lo vuelve a encender, y si Pgpool queda `unhealthy`, lo reinicia para recuperar el endpoint unico.

Tambien existe `dlq-recovery`, que observa RabbitMQ Management API y reinyecta mensajes desde colas DLQ para facilitar recuperacion automatica ante fallos transitorios en consumidores.

## Rutas principales por gateway

- `GET /api/menu/productos`
- `GET /api/menu/productos/disponibles`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/{id}`
- `GET /api/inventory/check`
- `GET /api/kitchen/orders`
- `GET /api/delivery/{id}`
- `GET /api/delivery/by-order/{orderId}`
- `GET /api/notifications/{id}`

## Rate limiting con Redis

El gateway usa Redis para limitar peticiones por cliente. En Docker Compose queda configurado con:

```text
API_RATE_LIMIT_CAPACITY=100000
API_RATE_LIMIT_WINDOW_SECONDS=60
API_RATE_LIMIT_FAIL_OPEN=true
```

Las respuestas del gateway incluyen encabezados `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Window-Seconds`. Si Redis se reinicia, el gateway mantiene el trafico con degradacion controlada por `fail-open`; los timeouts de Redis estan configurados en `500ms` para que la degradacion sea rapida. En esa condicion el gateway agrega `X-RateLimit-Redis: unavailable`.

## RabbitMQ

Los microservicios se conectan a RabbitMQ con:

```text
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=guest
SPRING_RABBITMQ_PASSWORD=guest
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

La consola web permite revisar colas, consumidores y mensajes pendientes:

```text
http://localhost:15672
```

Las metricas Prometheus de RabbitMQ quedan expuestas en:

```text
http://localhost:15692/metrics
```

## Observabilidad

Prometheus:

```text
http://localhost:9090
```

Grafana:

```text
http://localhost:3000
```

El dashboard principal muestra:

- CPU y memoria por contenedor.
- metricas JVM.
- estado de servicios.
- colas RabbitMQ.
- mensajes Ready y Unacked.

## Backups

El servicio `postgres-backup` ejecuta `pg_dump` automaticamente cada 5 minutos y conserva los ultimos 10 backups en:

```text
backups/postgres/
```

Ver backups:

```powershell
Get-ChildItem .\backups\postgres
```

Ver logs:

```powershell
docker logs -f fastorder-postgres-backup
```

La restauracion es manual y esta documentada en [backups.md](./backups.md).

## Pruebas de rendimiento

Los scripts k6 estan en:

```text
monitoring/k6/
```

Ejemplo 50k:

```powershell
k6 run .\monitoring\k6\order-write-test.js
```

Ver resultado final de negocio:

```powershell
node .\monitoring\check-results.js
```

## Detener

```bash
docker compose down
```

Eliminar datos persistidos:

```bash
docker compose down -v
```

Advertencia: `down -v` elimina la base de datos local.

## Archivos relacionados

- [docker-compose.md](./docker-compose.md)
- [database.md](./database.md)
- [backups.md](./backups.md)
- [arquitectura.md](./arquitectura.md)
- [load-testing-k6.md](./load-testing-k6.md)
