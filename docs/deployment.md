# Deployment

## Resumen

FastOrder HA se despliega localmente con Docker Compose. El despliegue actual levanta microservicios, base de datos, RabbitMQ, Redis, Prometheus, Grafana y cAdvisor.

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
| `fastorder-db` | `5440` | PostgreSQL |
| `rabbitmq` | `5672` | Broker |
| `redis` | `6379` | Rate limiting del gateway |
| `prometheus` | `9090` | Metricas |
| `grafana` | `3000` | Dashboards |
| `cadvisor` | `8087` | Contenedores |

## Health checks

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8082/actuator/health
curl http://localhost:8083/actuator/health
curl http://localhost:8084/actuator/health
curl http://localhost:8085/actuator/health
curl http://localhost:8086/actuator/health
```

## Rutas principales por gateway

- `GET /api/menu/productos`
- `GET /api/menu/productos/disponibles`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/{id}`
- `GET /api/inventory/check`
- `GET /api/kitchen/orders`
- `GET /api/delivery`
- `GET /api/notifications`

## Rate limiting con Redis

El gateway usa Redis para limitar peticiones por cliente. En Docker Compose queda configurado con:

```text
API_RATE_LIMIT_CAPACITY=100000
API_RATE_LIMIT_WINDOW_SECONDS=60
API_RATE_LIMIT_FAIL_OPEN=true
```

Las respuestas del gateway incluyen encabezados `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Window-Seconds`. Si Redis se reinicia, el gateway mantiene el trafico con degradacion controlada por `fail-open`; los timeouts de Redis estan configurados en `500ms` para que la degradacion sea rapida.

## RabbitMQ

Los microservicios se conectan a RabbitMQ con:

```text
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=guest
SPRING_RABBITMQ_PASSWORD=guest
```

La consola web permite revisar colas, consumidores y mensajes pendientes:

```text
http://localhost:15672
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
- [arquitectura.md](./arquitectura.md)
- [load-testing-k6.md](./load-testing-k6.md)
