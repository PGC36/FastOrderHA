# RabbitMQ Multi-Host HA

Esta carpeta deja lista una base para clusterizar `RabbitMQ` entre `PC2`, `PC3` y `PC4` sin tocar la capa de base de datos.

## Objetivo

- reemplazar el broker unico por un clúster de 3 nodos
- permitir que las apps usen varias direcciones Rabbit con `SPRING_RABBITMQ_ADDRESSES`
- preparar las colas de los servicios para `quorum queues`

## Archivos

- [rabbitmq.conf.tmpl](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/rabbitmq.conf.tmpl)
- [docker-compose.rabbitmq.pc2.yml](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/docker-compose.rabbitmq.pc2.yml)
- [docker-compose.rabbitmq.pc3.yml](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/docker-compose.rabbitmq.pc3.yml)
- [docker-compose.rabbitmq.pc4.yml](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/docker-compose.rabbitmq.pc4.yml)
- [multi-host.rabbitmq.env.example](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/multi-host.rabbitmq.env.example)

## Requisitos

- `PC2`, `PC3` y `PC4` deben poder resolverse por los nombres definidos en el env o al menos alcanzar sus IPs
- abrir puertos `5672`, `15672`, `15692`, `25672` y `4369`
- usar el mismo `RABBITMQ_ERLANG_COOKIE` en los tres nodos

## Preparacion

1. Copien el env:

```powershell
Copy-Item .\deploy\multi-host\multi-host.rabbitmq.env.example .\deploy\multi-host\multi-host.rabbitmq.env
```

2. Ajusten nombres/IPs:

```env
RABBITMQ_NODE_1_NAME=rabbit-pc2
RABBITMQ_NODE_1_IP=192.168.0.5
RABBITMQ_NODE_2_NAME=rabbit-pc3
RABBITMQ_NODE_2_IP=192.168.0.6
RABBITMQ_NODE_3_NAME=rabbit-pc4
RABBITMQ_NODE_3_IP=192.168.0.7
RABBITMQ_ADDRESSES=192.168.0.5:5672,192.168.0.6:5672,192.168.0.7:5672
```

## Arranque sugerido

En `PC2`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.rabbitmq.env -f .\deploy\multi-host\docker-compose.rabbitmq.pc2.yml up -d
```

En `PC3`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.rabbitmq.env -f .\deploy\multi-host\docker-compose.rabbitmq.pc3.yml up -d
```

En `PC4`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.rabbitmq.env -f .\deploy\multi-host\docker-compose.rabbitmq.pc4.yml up -d
```

## Verificacion

Desde cualquier nodo:

```bash
docker exec fastorder-rabbitmq-pc2 rabbitmqctl cluster_status
```

o en los otros hosts:

```bash
docker exec fastorder-rabbitmq-pc3 rabbitmqctl cluster_status
docker exec fastorder-rabbitmq-pc4 rabbitmqctl cluster_status
```

## Notas importantes

- Los microservicios multi-host ahora pueden recibir `SPRING_RABBITMQ_ADDRESSES` para intentar varios brokers.
- Las colas quedaron preparadas para `quorum` por propiedad `app.rabbit.queue-type`.
- No pude probar el clúster real desde esta máquina porque faltan `PC3` y `PC4`.
- Si ya existen colas `classic`, cambiar a `quorum` puede requerir recrearlas en un entorno controlado.
