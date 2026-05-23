# Docker Compose

## Resumen

El archivo principal de compatibilidad sigue siendo [docker-compose.yml](../docker-compose.yml), pero la forma recomendada de trabajar ahora es por capas:

- [docker-compose.infra-db.yml](../docker-compose.infra-db.yml)
- [docker-compose.infra-mq.yml](../docker-compose.infra-mq.yml)
- [docker-compose.app.yml](../docker-compose.app.yml)
- [docker-compose.observability.yml](../docker-compose.observability.yml)

Esta separacion ayuda a:

- aislar el estado critico de PostgreSQL HA y backups;
- mover microservicios entre PCs sin arrastrar toda la infraestructura;
- levantar solo lo necesario para pruebas puntuales;
- combinar stacks con `docker compose -f ... up -d`.

## Archivos separados

| Archivo | Contenido |
|---|---|
| `docker-compose.infra-db.yml` | Patroni, etcd, HAProxy, `db-recovery`, backups y exporters de BD |
| `docker-compose.infra-mq.yml` | RabbitMQ y recuperacion de DLQ |
| `docker-compose.app.yml` | API Gateway y microservicios de negocio |
| `docker-compose.observability.yml` | Prometheus, Grafana, cAdvisor y exporter de Docker |

## Flujo recomendado

Infraestructura base:

```bash
docker compose -f docker-compose.infra-db.yml -f docker-compose.infra-mq.yml up -d
```

Microservicios:

```bash
docker compose -f docker-compose.infra-db.yml -f docker-compose.infra-mq.yml -f docker-compose.app.yml up -d
```

Observabilidad:

```bash
docker compose -f docker-compose.infra-db.yml -f docker-compose.infra-mq.yml -f docker-compose.app.yml -f docker-compose.observability.yml up -d
```

## Capa de base de datos

| Servicio | Funcion | Puerto local |
|---|---|---:|
| `fastorder-db` | `HAProxy` / endpoint unico | `5440` |
| `fastorder-db-0` | Nodo Patroni/PostgreSQL | interno |
| `fastorder-db-1` | Nodo Patroni/PostgreSQL | interno |
| `fastorder-db-2` | Nodo Patroni/PostgreSQL | interno |
| `etcd-0` | Coordinacion del cluster | interno |
| `etcd-1` | Coordinacion del cluster | interno |
| `etcd-2` | Coordinacion del cluster | interno |
| `db-recovery` | Watcher de recuperacion de nodos de BD | interno |
| `postgres-backup` | Backups automaticos con `pg_dump` | interno |

Todos los microservicios usan `fastorder-db:5432`. `HAProxy` enruta al lider actual y `Patroni` decide promociones usando `etcd`.

## Backups

Variables principales:

```text
PGHOST=fastorder-db
PGPORT=5432
PGDATABASE=fastorder_db
PGUSER=postgres
PGPASSWORD=fastorder123
BACKUP_INTERVAL_SECONDS=300
BACKUP_RETENTION_COUNT=10
```

Los archivos se guardan en:

```text
backups/postgres/
```

## RabbitMQ

RabbitMQ:

```text
host interno: rabbitmq
puerto AMQP: 5672
usuario: guest
password: guest
management: http://localhost:15672
metricas: http://localhost:15692/metrics
```

## Variables principales de aplicacion

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://fastorder-db:5432/fastorder_db
SPRING_DATASOURCE_USERNAME=fastorder_user
SPRING_DATASOURCE_PASSWORD=fastorder123
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=guest
SPRING_RABBITMQ_PASSWORD=guest
```

`docker-compose.app.yml` permite sobrescribir la conexion a la BD con:

```text
FASTORDER_DB_HOST
FASTORDER_DB_PORT
FASTORDER_DB_NAME
FASTORDER_DB_USER
FASTORDER_DB_PASSWORD
```

Eso permite dejar la app en otra PC y apuntarla al proxy del cluster Patroni.

## Volumenes persistentes

La capa de BD usa volumenes para los tres nodos y para `etcd`:

```text
fastorder_db_0_data
fastorder_db_1_data
fastorder_db_2_data
fastorder_etcd_0_data
fastorder_etcd_1_data
fastorder_etcd_2_data
```

## Comandos utiles

Levantar infraestructura:

```bash
docker compose -f docker-compose.infra-db.yml -f docker-compose.infra-mq.yml up -d
```

Levantar solo aplicacion:

```bash
docker compose -f docker-compose.app.yml up -d
```

Levantar todo:

```bash
docker compose up --build -d
```

Detener:

```bash
docker compose down
docker compose down -v
```

## Archivos relacionados

- [docker-compose.yml](../docker-compose.yml)
- [deployment.md](./deployment.md)
- [database.md](./database.md)
- [backups.md](./backups.md)
- [arquitectura.md](./arquitectura.md)
