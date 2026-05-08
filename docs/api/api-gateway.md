# API Gateway

## Descripcion

El API Gateway es el punto de entrada HTTP para FastOrder HA. Su responsabilidad actual es recibir peticiones externas y redirigirlas hacia los microservicios internos configurados en `api-gateway/src/main/resources/application.yaml`.

El gateway no implementa logica de negocio de pedidos. Su funcion es enrutar solicitudes y exponer endpoints operativos de Actuator.

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
| `menu-service` | `/api/menu/**` | `http://menu-service:8081` | Pendiente: servicio no implementado |
| `order-service-root` | `/api/orders` | `http://order-service:8082` | Implementado |
| `order-service-paths` | `/api/orders/**` | `http://order-service:8082` | Implementado |
| `inventory-service` | `/api/inventory/**` | `http://inventory-service:8083` | Pendiente: servicio no implementado |
| `kitchen-service` | `/api/kitchen/**` | `http://kitchen-service:8084` | Pendiente: servicio no implementado |
| `delivery-service` | `/api/delivery/**` | `http://delivery-service:8085` | Pendiente: servicio no implementado |
| `notification-service` | `/api/notifications/**` | `http://notification-service:8086` | Pendiente: servicio no implementado |

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

El API Gateway esta configurado para enrutar hacia todos los microservicios previstos por la arquitectura. Actualmente, la ruta funcional implementada a nivel de microservicio es `order-service`.

Las rutas hacia `menu-service`, `inventory-service`, `kitchen-service`, `delivery-service` y `notification-service` dependen de aplicaciones que todavia estan pendientes de implementacion. Por esa razon, esas rutas pueden fallar en ejecucion hasta que dichos servicios existan y esten levantados dentro de la red de Docker.
