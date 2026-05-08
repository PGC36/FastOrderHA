# Arquitectura

## Resumen

FastOrder HA está organizado como una arquitectura de microservicios orientada a dominios separados. Cada microservicio tiene su propia base de datos PostgreSQL, y la entrada principal al sistema se hace mediante un `api-gateway`.

Además de los servicios de aplicación, el entorno incluye Redis, RabbitMQ y una carpeta de monitoreo con Prometheus y Grafana para observabilidad del stack.

## Componentes principales

Actualmente el proyecto está compuesto por:

- `api-gateway`
- `menu-service`
- `inventory-service`
- `order-service`
- `kitchen-service`
- `delivery-service`
- `notification-service`
- bases PostgreSQL separadas por servicio
- `redis`
- `rabbitmq`
- carpeta `monitoring/` para observabilidad

## Estructura general del repositorio

```text
FASTORDERHA/
├── api-gateway/
├── menu-service/
├── inventory-service/
├── order-service/
├── kitchen-service/
├── delivery-service/
├── notification-service/
├── database/
├── monitoring/
├── docs/
└── docker-compose.yml
```

## Estilo arquitectónico

La arquitectura sigue estas decisiones principales:

- separación por microservicio
- una base de datos por dominio
- comunicación síncrona vía HTTP entre algunos servicios
- preparación para comunicación asíncrona con RabbitMQ
- entrada centralizada mediante `api-gateway`
- despliegue local con Docker Compose

## Microservicios actuales

### `api-gateway`

Responsabilidad:

- centralizar el acceso HTTP a los microservicios internos.

Puerto:

- `8080`

Tecnología observable:

- Spring Cloud Gateway MVC

Rutas actualmente configuradas:

- `/api/menu/**` -> `menu-service`
- `/api/orders` y `/api/orders/**` -> `order-service`
- `/api/inventory/**` -> `inventory-service`
- `/api/kitchen/**` -> `kitchen-service`
- `/api/delivery` y `/api/delivery/**` -> `delivery-service`
- `/api/notifications` y `/api/notifications/**` -> `notification-service`

### `menu-service`

Responsabilidad:

- gestionar catálogo de productos del menú.

Puerto:

- `8081`

Base:

- `menu_db`

### `inventory-service`

Responsabilidad:

- gestionar stock y reservas de inventario.

Puerto:

- `8083`

Base:

- `inventory_db`

Dependencia observable:

- RabbitMQ está definido en su entorno de ejecución.

### `order-service`

Responsabilidad:

- gestionar creación y consulta de pedidos.

Puerto:

- `8082`

Base:

- `order_db`

Características relevantes:

- usa patrón Outbox a nivel de base de datos
- consume servicios HTTP internos de inventario, cocina, delivery y notificaciones
- tiene configuración para RabbitMQ

### `kitchen-service`

Responsabilidad:

- gestionar órdenes de cocina y estados de preparación.

Puerto:

- `8084`

Base:

- `kitchen_db`

Características relevantes:

- expone API REST
- usa PostgreSQL independiente
- expone health y métricas Prometheus

### `delivery-service`

Responsabilidad:

- gestionar entregas, estados de despacho y trazabilidad de cambios de estado.

Puerto:

- `8085`

Base:

- `delivery_db`

Características relevantes:

- expone API REST
- usa PostgreSQL independiente
- mantiene historial de estados
- expone health y métricas Prometheus

### `notification-service`

Responsabilidad:

- gestionar notificaciones del sistema.

Puerto:

- `8086`

Base:

- `notification_db`

Dependencia observable:

- tiene configuración para RabbitMQ

## Bases de datos por dominio

El proyecto usa una base separada por microservicio:

| Servicio | Base | Puerto local |
|---|---|---:|
| `menu-service` | `menu_db` | `5441` |
| `inventory-service` | `inventory_db` | `5442` |
| `order-service` | `order_db` | `5443` |
| `kitchen-service` | `kitchen_db` | `5444` |
| `delivery-service` | `delivery_db` | `5445` |
| `notification-service` | `notification_db` | `5446` |

Esto implica:

- no existen foreign keys entre bases distintas
- la relación entre dominios se maneja a nivel lógico
- cada servicio controla su propio esquema

Más detalle:

- ver [database.md](./database.md)

## Comunicación entre servicios

### Comunicación síncrona actual

El sistema ya muestra integración HTTP directa en estos casos:

- `api-gateway` reenvía requests a los servicios internos
- `order-service` tiene URLs internas configuradas hacia:
  - `inventory-service`
  - `kitchen-service`
  - `delivery-service`
  - `notification-service`

### Comunicación asíncrona prevista

RabbitMQ ya forma parte del entorno y algunos servicios ya tienen variables configuradas para conectarse.

Esto sugiere una arquitectura preparada para:

- publicación de eventos
- procesamiento desacoplado
- consistencia eventual entre dominios

En el estado actual del repositorio:

- `order-service` tiene outbox en base de datos
- `inventory-service`, `order-service` y `notification-service` ya muestran configuración de RabbitMQ
- `kitchen-service` y `delivery-service` todavía se apoyan principalmente en REST

## Infraestructura compartida

### PostgreSQL

- una instancia separada por dominio
- inicialización con scripts SQL propios

### Redis

Servicio disponible:

- `redis:6379`

Rol actual observable:

- infraestructura preparada en Compose

### RabbitMQ

Servicio disponible:

- `rabbitmq:5672`
- panel de administración en `15672`

Rol actual observable:

- infraestructura para mensajería asíncrona

### Observabilidad

El proyecto incluye:

- carpeta `monitoring/`
- `prometheus.yml`
- carpeta `grafana/`

Además:

- `api-gateway`, `kitchen-service` y `delivery-service` exponen métricas Prometheus

## Flujo lógico de negocio

A nivel de dominio, el flujo esperado del sistema se entiende así:

1. un cliente entra por `api-gateway`
2. se consulta menú y disponibilidad
3. `order-service` crea el pedido
4. `inventory-service` participa en la validación o reserva lógica de stock
5. `kitchen-service` recibe o registra la orden de cocina
6. `delivery-service` gestiona la entrega
7. `notification-service` emite notificaciones al usuario o al sistema

Este flujo no implica necesariamente que toda la coordinación actual esté resuelta por eventos; parte de la integración visible hoy es síncrona vía HTTP.

## Despliegue local

La arquitectura local está pensada para levantarse con:

- `docker-compose.yml`

Ese archivo hoy define:

- bases de datos
- servicios de aplicación
- Redis
- RabbitMQ
- red compartida `fastorder-network`
- volúmenes persistentes por base de datos

## Decisiones arquitectónicas visibles

A partir del estado real del repositorio, ya se observan estas decisiones:

- adopción de microservicios por dominio
- base de datos por servicio
- gateway como punto único de entrada
- combinación de comunicación síncrona y preparación para asincronía
- uso de Docker Compose como entorno de integración local
- separación de monitoreo en carpeta dedicada

## Estado actual

La arquitectura ya tiene una base funcional y visible en código:

- `api-gateway` está configurado
- `order-service`, `kitchen-service` y `delivery-service` ya tienen implementación documentada
- las seis bases están definidas
- Redis y RabbitMQ ya forman parte del entorno
- Prometheus y Grafana ya tienen espacio reservado dentro del repositorio

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [database.md](./database.md)
- [deployment.md](./deployment.md)
- [api-gateway/application.yaml](../api-gateway/src/main/resources/application.yaml)
