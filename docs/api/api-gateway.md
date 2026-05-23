# API Gateway

## Descripcion

El API Gateway es el punto de entrada HTTP para FastOrder HA. Su responsabilidad actual es recibir peticiones externas y redirigirlas hacia los microservicios internos configurados en `api-gateway/src/main/resources/application.yaml`.

El gateway no implementa logica de negocio de pedidos. Su funcion es proteger la entrada, enrutar solicitudes y exponer endpoints operativos de Actuator.

## Tecnologias usadas

| Tecnologia | Uso |
| --- | --- |
| Java 21 | Runtime del servicio |
| Spring Boot 3.5.14 | Base de la aplicacion |
| Spring Cloud Gateway Server WebMVC | Enrutamiento HTTP hacia microservicios |
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
| `delivery-service-root` | `/api/delivery` | `http://delivery-service:8085` | Implementado |
| `delivery-service-paths` | `/api/delivery/**` | `http://delivery-service:8085` | Implementado |
| `notification-service-root` | `/api/notifications` | `http://notification-service:8086` | Implementado |
| `notification-service-paths` | `/api/notifications/**` | `http://notification-service:8086` | Implementado |

## Rate limiting

El gateway enruta trafico sin una capa adicional de rate limiting en esta version.

Cuando el cliente supera el limite, el gateway responde `429 Too Many Requests`. Cada respuesta normal incluye:

| Header | Significado |
| --- | --- |
| `X-RateLimit-Limit` | Limite maximo de la ventana |
| `X-RateLimit-Remaining` | Peticiones restantes para el cliente |
| `X-RateLimit-Window-Seconds` | Duracion de la ventana |

No hay comportamiento especial asociado a Redis en la version actual.

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

## Redireccion hacia delivery-service

`delivery-service` no usa `StripPrefix`. El gateway reescribe la ruta externa hacia el prefijo real `/deliveries` del microservicio:

| Peticion al gateway | Peticion enviada a delivery-service |
| --- | --- |
| `GET /api/delivery` | `GET /deliveries` |
| `POST /api/delivery` | `POST /deliveries` |
| `GET /api/delivery/1` | `GET /deliveries/1` |
| `PATCH /api/delivery/1/deliver` | `PATCH /deliveries/1/deliver` |

Esto se implementa con filtros `RewritePath`.

## Endpoints de Actuator

El API Gateway expone endpoints operativos mediante Actuator:

| Endpoint | Descripcion |
| --- | --- |
| `GET /actuator/health` | Estado de salud del gateway |
| `GET /actuator/prometheus` | Metricas en formato Prometheus |

La configuracion actual tambien incluye `info` dentro de la exposicion de Actuator.

## Estado actual

El API Gateway esta configurado para enrutar hacia todos los microservicios previstos por la arquitectura. La logica de negocio sigue viviendo en los microservicios.
