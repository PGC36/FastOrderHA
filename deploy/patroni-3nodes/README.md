# Patroni Assets

Esta carpeta ya no contiene `docker-compose` activos del proyecto.

La arquitectura oficial de FastOrder HA ahora vive en:

- [docker-compose.infra-db.yml](../../docker-compose.infra-db.yml)
- [docker-compose.app.yml](../../docker-compose.app.yml)
- [docker-compose.infra-mq.yml](../../docker-compose.infra-mq.yml)
- [docker-compose.observability.yml](../../docker-compose.observability.yml)

Los archivos de esta carpeta se conservan porque el compose oficial los reutiliza:

- `patroni/Dockerfile`
- `patroni/patroni.yml.tmpl`
- `haproxy/Dockerfile`
- `haproxy/haproxy-fastorder.cfg.tmpl`
- `scripts/post-bootstrap.sh`

Los archivos `.env.*.example` quedan solo como referencia si luego quieren desplegar el cluster en varias PCs con variables separadas.
