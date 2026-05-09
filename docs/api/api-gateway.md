# API Gateway

## Descripcion

El API Gateway es el punto de entrada HTTP para FastOrder HA. Su responsabilidad actual es recibir peticiones externas, aplicar rate limiting con Redis y redirigirlas hacia los microservicios internos configurados en `api-gateway/src/main/resources/application.yaml`.

El gateway no implementa logica de negocio de pedidos. Su funcion es proteger la entrada, enrutar solicitudes y exponer endpoints operativos de Actuator.

## Tecnologias usadas

| Tecnologia | Uso |
| --- | --- |
| Java 21 | Runtime del servicio |
| Spring Boot 3.5.14 | Base de la aplicacion |
| Spring Cloud Gateway Server WebMVC | Enrutamiento HTTP hacia microservicios |
| Spring Data Redis | Contadores de rate limiting por cliente |
| Spring Boot Actuator | Endpoints de monitoreo |
| Micrometer Prometheus | Exportacion de metricas |
| Maven | Gestion de dependencias y build |

## Puerto

| Entorno | Puerto |
| --- | --- |
| API Gateway | `8080` |

## Rutas configuradas

| ID de ruta | Path externo | Destino interno | Estado del destino |
| --- | --- | --- | --- |
| `menu-service` | `/api/menu/**` | `http://menu-service:8081` | Implementado |
| `order-service-root` | `/api/orders` | `http://order-service:8082` | Implementado |
| `order-service-paths` | `/api/orders/**` | `http://order-service:8082` | Implementado |
| `inventory-service` | `/api/inventory/**` | `http://inventory-service:8083` | Implementado |
| `kitchen-service` | `/api/kitchen/**` | `http://kitchen-service:8084` | Implementado |
| `delivery-service` | `/api/delivery/**` | `http://delivery-service:8085` | Implementado |
| `notification-service` | `/api/notifications/**` | `http://notification-service:8086` | Implementado |

## Rate limiting

El gateway usa Redis para contar peticiones por cliente en una ventana de tiempo. La configuracion por defecto permite la prueba de estres de 50,000 peticiones sin bloquearla:

```text
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_FAIL_OPEN=true
API_RATE_LIMIT_CAPACITY=100000
API_RATE_LIMIT_WINDOW_SECONDS=60
SPRING_DATA_REDIS_TIMEOUT=500ms
SPRING_DATA_REDIS_CONNECT_TIMEOUT=500ms
```

Cuando el cliente supera el limite, el gateway responde `429 Too Many Requests`. Cada respuesta normal incluye:

| Header | Significado |
| --- | --- |
| `X-RateLimit-Limit` | Limite maximo de la ventana |
| `X-RateLimit-Remaining` | Peticiones restantes para el cliente |
| `X-RateLimit-Window-Seconds` | Duracion de la ventana |

Si Redis se reinicia, `API_RATE_LIMIT_FAIL_OPEN=true` permite que el gateway siga operando y agrega `X-RateLimit-Redis: unavailable`. Los timeouts de Redis se mantienen bajos para que esa degradacion ocurra rapido.

## Redireccion hacia order-service

El gateway tiene dos rutas para `order-service`:

- `/api/orders`
- `/api/orders/**`

Ambas usan `StripPrefix=1`, por lo que el prefijo `/api` se elimina antes de enviar la peticion al microservicio.

Ejemplos:

| Peticion al gateway | Peticion enviada a order-service |
| --- | --- |
| `GET /api/orders` | `GET /orders` |
| `POST /api/orders` | `POST /orders` |
| `GET /api/orders/1` | `GET /orders/1` |
| `GET /api/orders/health-check` | `GET /orders/health-check` |

## Endpoints de Actuator

El API Gateway expone endpoints operativos mediante Actuator:

| Endpoint | Descripcion |
| --- | --- |
| `GET /actuator/health` | Estado de salud del gateway |
| `GET /actuator/prometheus` | Metricas en formato Prometheus |

La configuracion actual tambien incluye `info` dentro de la exposicion de Actuator.

## Estado actual

El API Gateway esta configurado para enrutar hacia todos los microservicios previstos por la arquitectura y para proteger la entrada con Redis. La logica de negocio sigue viviendo en los microservicios.
