# RabbitMQ Multi-Host

La configuracion actual deja `RabbitMQ` estable en `PC2` como broker unico para la demo multi-host.

## Objetivo

- mantener un broker funcional en `PC2`
- hacer que `PC2` y `PC3` apunten a `192.168.0.5:5672`
- conservar la logica de colas, DLQ y reintentos de la aplicacion

## Archivos

- [docker-compose.rabbitmq.pc2.yml](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/docker-compose.rabbitmq.pc2.yml)
- [multi-host.rabbitmq.env.example](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/multi-host.rabbitmq.env.example)
- [multi-host.app.env.example](/c:/ProyectoBDII/FastOrderHA/deploy/multi-host/multi-host.app.env.example)

## Preparacion

1. Copien el env de Rabbit:

```powershell
Copy-Item .\deploy\multi-host\multi-host.rabbitmq.env.example .\deploy\multi-host\multi-host.rabbitmq.env
```

2. Dejen `PC2` como broker principal:

```env
RABBITMQ_NODE_1_NAME=rabbit-pc2
RABBITMQ_NODE_1_IP=192.168.0.5
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest
```

3. En el env de app usen solo `PC2`:

```env
RABBITMQ_HOST=192.168.0.5
RABBITMQ_PORT=5672
RABBITMQ_ADDRESSES=192.168.0.5:5672
RABBITMQ_WAIT_HOST=192.168.0.5
RABBITMQ_WAIT_PORT=5672
```

## Arranque

En `PC2`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.rabbitmq.env -f .\deploy\multi-host\docker-compose.rabbitmq.pc2.yml up -d
```

En `PC3` y `PC4` no es necesario levantar los compose de Rabbit para esta version estable de la demo.

## Verificacion

En `PC2`:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i rabbit
docker logs fastorder-rabbitmq-pc2 --tail 50
```

Web de management:

- `http://192.168.0.5:15672`

## Notas

- La aplicacion queda apuntando a un solo broker para priorizar estabilidad de la demo.
- La BD sigue siendo la parte que si queda en HA completo.
- Las colas siguen preparadas por propiedad `app.rabbit.queue-type`.
