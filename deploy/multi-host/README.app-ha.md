# App Multi-Host HA

Estos archivos dejan la app distribuida entre `PC2` y `PC3`, con `RabbitMQ` estable en `PC2` y con soporte para una VIP de app entre ambos nodos.

## Que resuelve

- `api-gateway` y las llamadas HTTP entre microservicios ya no dependen de nombres locales de Docker
- cada host tiene su `service-router` para enrutar a instancias vivas
- cada host tiene su `db-client-proxy` local para entrar a la BD HA
- `PC3` ahora tambien puede correr `menu`, `inventory`, `order` y `kitchen`
- la app puede exponerse por una VIP entre `PC2` y `PC3`

## Distribucion sugerida

- `PC2`
  - `api-gateway`
  - `service-router`
  - `app-entry-proxy`
  - `db-client-proxy`
  - `menu-service`
  - `inventory-service`
  - `order-service`
  - `kitchen-service`
  - `RabbitMQ`
- `PC3`
  - `api-gateway`
  - `service-router`
  - `app-entry-proxy`
  - `db-client-proxy`
  - `menu-service`
  - `inventory-service`
  - `order-service`
  - `kitchen-service`
  - `delivery-service`
  - `notification-service`

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
APP_GATEWAY_NODE_1_IP=192.168.0.5
APP_GATEWAY_NODE_2_IP=192.168.0.6
APP_VIP_IP=192.168.0.101
DB_PROXY_PRIMARY_HOST=192.168.0.5
DB_PROXY_SECONDARY_HOST=192.168.0.7
RABBITMQ_HOST=192.168.0.5
RABBITMQ_PORT=5672
RABBITMQ_ADDRESSES=192.168.0.5:5672
RABBITMQ_WAIT_HOST=192.168.0.5
RABBITMQ_WAIT_PORT=5672
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

## VIP de app con keepalived

La VIP de app debe convivir con la VIP de BD sin sobrescribir la configuracion existente de `keepalived`.

### PC2: config combinada BD + app

```bash
set -a
source deploy/multi-host/multi-host.env
source deploy/multi-host/multi-host.app.env
set +a
envsubst < deploy/multi-host/keepalived.combined.pc2.conf.tmpl | sudo tee /etc/keepalived/keepalived.conf
sudo keepalived -t -f /etc/keepalived/keepalived.conf
sudo systemctl restart keepalived
```

### PC3: VIP de app

```bash
set -a
source deploy/multi-host/multi-host.app.env
set +a
envsubst < deploy/multi-host/keepalived.pc3.conf.tmpl | sudo tee /etc/keepalived/keepalived.conf
sudo keepalived -t -f /etc/keepalived/keepalived.conf
sudo systemctl restart keepalived
```

### PC4: VIP de BD

```bash
set -a
source deploy/multi-host/multi-host.env
set +a
envsubst < deploy/multi-host/keepalived.db.pc4.conf.tmpl | sudo tee /etc/keepalived/keepalived.conf
sudo keepalived -t -f /etc/keepalived/keepalived.conf
sudo systemctl restart keepalived
```

### Cliente

El cliente o `k6` debe entrar por:

```text
http://<APP_VIP_IP>:8080
```

Con eso:

- si `PC2` sigue vivo, la VIP de app queda en `PC2`
- si la app de `PC2` cae, `PC3` toma la VIP de app
- la VIP de BD sigue independiente entre `PC2` y `PC4`

## Verificacion

- `http://<PC2_IP>:8080/actuator/health`
- `http://<PC3_IP>:8080/actuator/health`
- `http://<APP_VIP_IP>:8080/actuator/health`
- `http://<APP_VIP_IP>:8080/api/menu/productos`
- `http://<APP_VIP_IP>:8080/api/orders`

## Prueba recomendada

1. Lanzar `50k` peticiones a la VIP de app
2. Detener `docker-compose.app.pc2.yml`
3. Verificar que `PC3` siga respondiendo por la misma VIP
