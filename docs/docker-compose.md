# Docker Compose

## Descripcion

`docker-compose.yml` define la infraestructura local de FastOrder HA. Permite levantar servicios de aplicacion, bases de datos, Redis, RabbitMQ y la red compartida necesaria para que los contenedores se comuniquen entre si.

Este archivo se usa principalmente para desarrollo local y pruebas tecnicas de integracion.

## Servicios configurados actualmente

Servicios principales solicitados para el estado actual:

| Servicio | Contenedor | Puerto local | Descripcion |
| --- | --- | --- | --- |
| `api-gateway` | `fastorder-api-gateway` | `8080` | Entrada HTTP del sistema |
| `order-service` | `fastorder-order-service` | `8082` | Microservicio de pedidos |
| `order-db` | `fastorder-order-db` | `5443` | PostgreSQL para `order-service` |
| `redis` | `fastorder-redis` | `6379` | Redis compartido para infraestructura futura |
| `rabbitmq` | `fastorder-rabbitmq` | `5672`, `15672` | Broker de mensajeria y consola web |

El archivo tambien contiene bases de datos para otros dominios:

| Servicio | Base | Puerto local | Estado |
| --- | --- | --- | --- |
| `menu-db` | `menu_db` | `5441` | Base configurada; aplicacion pendiente |
| `inventory-db` | `inventory_db` | `5442` | Base configurada; aplicacion pendiente |
| `kitchen-db` | `kitchen_db` | `5444` | Base configurada; aplicacion pendiente |
| `delivery-db` | `delivery_db` | `5445` | Base configurada; aplicacion pendiente |
| `notification-db` | `notification_db` | `5446` | Base configurada; aplicacion pendiente |

## Red fastorder-network

Todos los servicios configurados usan la red:

```text
fastorder-network
```

Esta red permite que los contenedores se resuelvan por nombre de servicio. Por ejemplo, dentro de Docker:

```text
order-service -> order-db:5432
api-gateway -> order-service:8082
order-service -> rabbitmq:5672
```

## Conexion dentro de Docker vs maquina local

Dentro de Docker se usan nombres de servicio y puertos internos:

| Recurso | URL interna |
| --- | --- |
| order-db | `jdbc:postgresql://order-db:5432/order_db` |
| RabbitMQ | `rabbitmq:5672` |
| order-service | `http://order-service:8082` |

Desde la maquina local se usan `localhost` y los puertos publicados:

| Recurso | URL local |
| --- | --- |
| order-db | `jdbc:postgresql://localhost:5443/order_db` |
| RabbitMQ AMQP | `localhost:5672` |
| RabbitMQ Management | `http://localhost:15672` |
| order-service | `http://localhost:8082` |
| API Gateway | `http://localhost:8080` |

## Comandos utiles

Levantar todos los servicios configurados:

```bash
docker compose up --build -d
```

Levantar solo lo necesario para probar `order-service`:

```bash
docker compose up --build -d order-db rabbitmq order-service
```

Ver contenedores activos:

```bash
docker ps
```

Ver logs de `order-service`:

```bash
docker compose logs -f order-service
```

Apagar servicios y eliminar volumenes:

```bash
docker compose down -v
```

> Nota: `docker compose down -v` elimina los volumenes de datos. Al volver a levantar PostgreSQL, los scripts `database/*-init.sql` se ejecutaran de nuevo sobre volumenes nuevos.

## Acceso a RabbitMQ

RabbitMQ expone la consola de administracion en:

```text
http://localhost:15672
```

Credenciales configuradas por defecto:

| Usuario | Contrasena |
| --- | --- |
| `guest` | `guest` |

El puerto AMQP usado por aplicaciones es:

```text
localhost:5672
```

## Acceso a order-service

Endpoint base local:

```text
http://localhost:8082/orders
```

Ejemplos:

```bash
curl http://localhost:8082/orders/health-check
curl http://localhost:8082/orders
```

## Acceso al API Gateway

Endpoint base local:

```text
http://localhost:8080
```

Ejemplos de rutas hacia `order-service` por medio del gateway:

```text
GET  http://localhost:8080/api/orders
POST http://localhost:8080/api/orders
GET  http://localhost:8080/api/orders/1
```

## Estado actual de Docker Compose

Docker Compose ya permite construir y levantar `order-service`, `order-db`, `rabbitmq`, `redis` y `api-gateway`.

El servicio `order-service` se conecta a `order-db` usando variables de entorno:

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://order-db:5432/order_db
SPRING_DATASOURCE_USERNAME=order_user
SPRING_DATASOURCE_PASSWORD=order123
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672
```

Las rutas del API Gateway hacia microservicios no implementados quedan pendientes hasta que existan las aplicaciones correspondientes dentro de la red `fastorder-network`.
