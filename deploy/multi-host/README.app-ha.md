# App Multi-Host HA (fase inicial)

Estos archivos agregan una capa multi-host para la aplicacion sin tocar la capa de base HA ya existente.

## Que resuelve

- permite que `api-gateway` y las llamadas HTTP entre microservicios dejen de depender de nombres locales de Docker
- agrega un `service-router` por host con `HAProxy` para enrutar hacia instancias vivas en `APP_NODE_1_IP`, `APP_NODE_2_IP` y `APP_NODE_3_IP`
- mantiene un `db-client-proxy` local por host para seguir entrando a la BD por los proxies de Patroni ya existentes

## Que no resuelve todavia

- `RabbitMQ` puede migrarse a clúster con los archivos `docker-compose.rabbitmq.pcX.yml`, pero no queda probado solo con estos cambios
- estos archivos son una fase inicial para HA de microservicios, no un reemplazo completo de un orquestador

## Distribucion sugerida

- `PC2`
  - `rabbitmq`
  - `api-gateway`
  - `service-router`
  - `db-client-proxy`
  - `menu-service`
  - `inventory-service`
  - `order-service`
  - `kitchen-service`
- `PC3`
  - `api-gateway`
  - `service-router`
  - `db-client-proxy`
  - `delivery-service`
  - `notification-service`

Con esta distribucion:

- si `PC1` muere, `PC2` y `PC3` siguen publicando API
- `api-gateway` puede llegar a servicios remotos via `service-router`
- `order-service` en `PC2` puede llamar a `delivery-service` y `notification-service` en `PC3`
- el conjunto `PC2 + PC3` asume la carga de `PC1`, pero esta fase todavia no garantiza que `PC2` o `PC3` por separado puedan reemplazar a todo el stack

## Preparacion

1. Copien el env:

```powershell
Copy-Item .\deploy\multi-host\multi-host.app.env.example .\deploy\multi-host\multi-host.app.env
```

2. Ajusten IPs reales:

```env
APP_NODE_1_IP=192.168.0.2
APP_NODE_2_IP=192.168.0.5
APP_NODE_3_IP=192.168.0.6
DB_PROXY_PRIMARY_HOST=192.168.0.5
DB_PROXY_SECONDARY_HOST=192.168.0.7
RABBITMQ_HOST=192.168.0.5
```

## Arranque

En `PC2`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.app.env -f .\deploy\multi-host\docker-compose.app.pc2.yml up -d --build
```

En `PC3`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.app.env -f .\deploy\multi-host\docker-compose.app.pc3.yml up -d --build
```

## Entrada automatica con VIP

Cada nodo ahora expone:

- `api-gateway` real en `18080`
- `app-entry-proxy` en `8080`

El `app-entry-proxy` balancea entre los gateways de `PC2` y `PC3`. Para que el cliente no cambie de IP cuando caiga un host, usen `keepalived` en Linux y muevan una VIP entre `PC2` y `PC3`.

1. Rendericen la configuracion en `PC2`:

```bash
env $(grep -v '^#' deploy/multi-host/multi-host.app.env | xargs) envsubst < deploy/multi-host/keepalived.pc2.conf.tmpl | sudo tee /etc/keepalived/keepalived.conf
```

2. Rendericen la configuracion en `PC3`:

```bash
env $(grep -v '^#' deploy/multi-host/multi-host.app.env | xargs) envsubst < deploy/multi-host/keepalived.pc3.conf.tmpl | sudo tee /etc/keepalived/keepalived.conf
```

3. Inicien `keepalived` en ambos hosts Linux:

```bash
sudo systemctl enable --now keepalived
```

4. Hagan que el cliente use la VIP:

```text
http://<APP_VIP_IP>:8080
```

Con eso:

- si `PC2` sigue vivo, la VIP queda en `PC2`
- si `PC2` cae completo, `PC3` toma la VIP
- el cliente sigue entrando por la misma IP

## Nota sobre Windows

`PC1` queda fuera de la app multi-host. Usen `PC1` para:

- su nodo de base HA
- observabilidad
- pruebas de carga con `k6`

La limitacion importante es otra:

- no recomiendo usar `PC1` Windows para `keepalived`
- la VIP automatica debe quedarse entre `PC2` y `PC3`, que son Linux
- `PC1` no participa como dueño de la VIP

## Verificacion

- `http://<PC2_IP>:18080/actuator/health`
- `http://<PC3_IP>:18080/actuator/health`
- `http://<PC2_IP>:8080/actuator/health`
- `http://<PC3_IP>:8080/actuator/health`
- `http://<PC2_IP>:7010/stats`
- `http://<PC3_IP>:7010/stats`
- `http://<PC2_IP>:7011/stats`
- `http://<PC3_IP>:7011/stats`

## Siguiente paso recomendado

El siguiente salto para HA real de toda la app es uno de estos:

- duplicar los microservicios criticos en ambos nodos en lugar de repartirlos por mitades
- terminar de levantar y validar el clúster de `RabbitMQ` en `PC2`, `PC3` y `PC4`
