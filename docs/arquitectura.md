# Arquitectura

## Resumen

FastOrder HA esta organizado como una arquitectura de microservicios orientada a dominios separados. La entrada principal al sistema se hace mediante `api-gateway` y todos los servicios comparten una base PostgreSQL general llamada `fastorder_db`.

Ademas de los servicios de aplicacion, el entorno incluye Redis, RabbitMQ y una carpeta de monitoreo con Prometheus y Grafana.

## Componentes principales

- `api-gateway`
- `menu-service`
- `inventory-service`
- `order-service`
- `kitchen-service`
- `delivery-service`
- `notification-service`
- `fastorder-db`
- `redis`
- `rabbitmq`
- carpeta `monitoring/`

## Estructura general del repositorio

```text
FASTORDERHA/
|-- api-gateway/
|-- menu-service/
|-- inventory-service/
|-- order-service/
|-- kitchen-service/
|-- delivery-service/
|-- notification-service/
|-- database/
|-- monitoring/
|-- docs/
`-- docker-compose.yml
```

## Estilo arquitectonico

Decisiones principales:

- separacion por microservicio
- una base de datos general para todo el stack local
- tablas separadas por dominio dentro de `fastorder_db`
- comunicacion sincrona via HTTP entre algunos servicios
- preparacion para comunicacion asincrona con RabbitMQ
- entrada centralizada mediante `api-gateway`
- despliegue local con Docker Compose

## Microservicios actuales

| Servicio | Responsabilidad | Puerto | Tablas principales |
|---|---|---:|---|
| `api-gateway` | Entrada HTTP centralizada | `8080` | N/A |
| `menu-service` | Catalogo de productos del menu | `8081` | `productos` |
| `order-service` | Creacion y consulta de pedidos | `8082` | `orders`, `outbox_events` |
| `inventory-service` | Stock y reservas de inventario | `8083` | `inventory` |
| `kitchen-service` | Ordenes y estados de cocina | `8084` | `kitchen_orders` |
| `delivery-service` | Entregas e historial de estados | `8085` | `delivery_orders`, `delivery_status_history` |
| `notification-service` | Notificaciones del sistema | `8086` | `notifications` |

## Base de datos general

El proyecto usa una sola base PostgreSQL:

| Servicio Compose | Base | Puerto local | Usuario |
|---|---|---:|---|
| `fastorder-db` | `fastorder_db` | `5440` | `fastorder_user` |

Los servicios se conectan internamente con:

```text
jdbc:postgresql://fastorder-db:5432/fastorder_db
```

Desde la maquina local:

```text
jdbc:postgresql://localhost:5440/fastorder_db
```

Mas detalle:

- ver [database.md](./database.md)

## Comunicacion entre servicios

### Comunicacion sincrona actual

- `api-gateway` reenvia requests a los servicios internos.
- `order-service` tiene URLs internas hacia:
  - `inventory-service`
  - `kitchen-service`
  - `delivery-service`
  - `notification-service`

### Comunicacion asincrona prevista

RabbitMQ forma parte del entorno y todos los microservicios de dominio tienen configuracion para conectarse.

Esto prepara al sistema para:

- publicacion de eventos
- procesamiento desacoplado
- consistencia eventual entre dominios
- colas durables por dominio

## Infraestructura compartida

### PostgreSQL

- contenedor `fastorder-db`
- base `fastorder_db`
- inicializacion con `database/fastorder-init.sql`
- volumen `fastorder_db_data`

### Redis

- servicio `redis:6379`

### RabbitMQ

- servicio `rabbitmq:5672`
- panel de administracion en `15672`

### Observabilidad

El proyecto incluye:

- carpeta `monitoring/`
- `prometheus.yml`
- carpeta `grafana/`

## Flujo logico de negocio

1. Un cliente entra por `api-gateway`.
2. Se consulta menu y disponibilidad.
3. `order-service` crea el pedido.
4. `inventory-service` participa en validacion o reserva logica de stock.
5. `kitchen-service` registra la orden de cocina.
6. `delivery-service` gestiona la entrega.
7. `notification-service` emite notificaciones.

## Despliegue local

La arquitectura local se levanta con:

- `docker-compose.yml`

Ese archivo define:

- `fastorder-db`
- servicios de aplicacion
- Redis
- RabbitMQ
- red compartida `fastorder-network`
- volumen persistente `fastorder_db_data`

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [database.md](./database.md)
- [deployment.md](./deployment.md)
- [api-gateway/application.yaml](../api-gateway/src/main/resources/application.yaml)
