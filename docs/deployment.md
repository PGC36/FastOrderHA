# Deployment

## Resumen

FastOrder HA se despliega localmente con Docker Compose. El stack actual levanta microservicios, PostgreSQL HA con `Patroni + etcd + HAProxy`, RabbitMQ, Prometheus, Grafana, cAdvisor, backups automaticos y recuperacion operativa.

Archivo principal:

- [docker-compose.yml](../docker-compose.yml)

## Requisitos

- Docker
- Docker Compose

## Levantar el entorno

```bash
docker compose up --build -d
docker compose ps
```

Tambien puedes usar el despliegue por capas:

```bash
docker compose -f docker-compose.infra-db.yml -f docker-compose.infra-mq.yml up -d
docker compose -f docker-compose.app.yml up -d
docker compose -f docker-compose.observability.yml up -d
```

## Componentes

| Servicio | Puerto | Funcion |
|---|---:|---|
| `api-gateway` | `8080` | Entrada HTTP |
| `menu-service` | `8081` | Menu |
| `order-service` | `8082` | Ordenes y Saga |
| `inventory-service` | `8083` | Stock |
| `kitchen-service` | `8084` | Cocina |
| `delivery-service` | `8085` | Entregas |
| `notification-service` | `8086` | Notificaciones |
| `fastorder-db` | `5440` | `HAProxy` / endpoint unico PostgreSQL |
| `fastorder-db-0` | interno | Nodo Patroni/PostgreSQL |
| `fastorder-db-1` | interno | Nodo Patroni/PostgreSQL |
| `fastorder-db-2` | interno | Nodo Patroni/PostgreSQL |
| `etcd-0/1/2` | interno | Coordinacion del cluster |
| `db-recovery` | interno | Recuperacion automatica de contenedores de BD |
| `postgres-backup` | interno | Backups automaticos |
| `dlq-recovery` | interno | Reinyeccion automatica de mensajes desde DLQ |
| `rabbitmq` | `5672` | Broker |
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
docker compose exec fastorder-db psql -h fastorder-db -U postgres -d fastorder_db -c "select 1;"
```

Verificar roles de los nodos:

```bash
docker compose exec fastorder-db-0 psql -U postgres -d fastorder_db -tAc "select pg_is_in_recovery();"
docker compose exec fastorder-db-1 psql -U postgres -d fastorder_db -tAc "select pg_is_in_recovery();"
docker compose exec fastorder-db-2 psql -U postgres -d fastorder_db -tAc "select pg_is_in_recovery();"
```

`f` indica lider y `t` indica replica.

## Prueba manual de failover

1. Identificar el lider con `pg_is_in_recovery()`.
2. Matar ese nodo con `docker kill`.
3. Esperar a que Patroni promueva otra replica.
4. Confirmar que `fastorder-db` sigue respondiendo.

Ejemplo:

```bash
docker kill fastorder-db-1
docker compose ps fastorder-db fastorder-db-0 fastorder-db-1 fastorder-db-2
docker compose exec fastorder-db psql -h fastorder-db -U postgres -d fastorder_db -c "select pg_is_in_recovery();"
```

`Patroni` resuelve el failover. `db-recovery` vuelve a levantar contenedores de BD apagados durante pruebas manuales.

## Backups

El servicio `postgres-backup` ejecuta `pg_dump` automaticamente cada 5 minutos y conserva los ultimos 10 backups en `backups/postgres/`.

```powershell
Get-ChildItem .\backups\postgres
docker logs -f fastorder-postgres-backup
```

La restauracion manual esta documentada en [backups.md](./backups.md).

## Detener

```bash
docker compose down
docker compose down -v
```

`down -v` elimina tambien los volumenes persistidos de PostgreSQL y `etcd`.

## Archivos relacionados

- [docker-compose.md](./docker-compose.md)
- [database.md](./database.md)
- [backups.md](./backups.md)
- [arquitectura.md](./arquitectura.md)
