# Despliegue Multi-PC en Windows

Estos archivos reparten la base HA entre 4 PCs y ahora permiten usar las IP reales de su red sin editar los `compose` a mano.

## Idea general

La recomendacion para Windows es:

- fijar una IP estatica o reserva DHCP por MAC a cada PC en el router
- permitir trafico entre esas IPs en el firewall de Windows
- usar el archivo `multi-host.env` para declarar las IPs reales
- levantar en cada PC solo su `docker-compose.pcX.yml`

Esto encaja con lo que te comentaron tus companeros: cada maquina queda identificada por su IP y el cluster usa esas IPs para hablar entre nodos.

## Distribucion

- `PC1`: `etcd-0` + `fastorder-db-0` + `postgres-backup`
- `PC2`: `etcd-1` + `fastorder-db-1` + `fastorder-db-proxy-1`
- `PC3`: `etcd-2` + `fastorder-db-2`
- `PC4`: `fastorder-db-proxy-2`

## 1. Configurar IPs

Copien el ejemplo y ajusten las IPs para su red:

```powershell
Copy-Item .\deploy\multi-host\multi-host.env.example .\deploy\multi-host\multi-host.env
notepad .\deploy\multi-host\multi-host.env
```

Ejemplo:

```env
PC1_IP=192.168.0.10
PC2_IP=192.168.0.11
PC3_IP=192.168.0.12
PC4_IP=192.168.0.13
```

Cada PC debe poder hacer `ping` a las otras 3 IPs.

## 2. Puertos que deben quedar abiertos

- `2379`, `2380` para `etcd`
- `5432`, `6432`, `5433` para PostgreSQL y proxies
- `7000` para stats de `HAProxy`
- `8008`, `8108` para `Patroni`
- `9187`, `9188`, `9189` para exporters
- backups locales en `backups/postgres`

Si Windows Firewall bloquea trafico entre maquinas, abran esos puertos o permitan Docker Desktop en la red privada.

## 3. Levantar cada PC

Desde la raiz del repo `FastOrderHA`, usando el mismo `multi-host.env` en todas las PCs:

En `PC1`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.env -f .\deploy\multi-host\docker-compose.pc1.yml up -d --build
```

En `PC2`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.env -f .\deploy\multi-host\docker-compose.pc2.yml up -d --build
```

En `PC3`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.env -f .\deploy\multi-host\docker-compose.pc3.yml up -d --build
```

En `PC4`:

```powershell
docker compose --env-file .\deploy\multi-host\multi-host.env -f .\deploy\multi-host\docker-compose.pc4.yml up -d --build
```

## 4. Observabilidad multi-host

Antes de levantar Prometheus, generen el archivo con las IPs reales:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\multi-host\render-prometheus-config.ps1
```

Luego levanten observabilidad en la PC donde tendran Prometheus y Grafana:

```powershell
docker compose -f .\deploy\multi-host\docker-compose.observability.yml up -d
```

## 5. App y failover automatico del proxy de BD

La app debe apuntar siempre a la VIP compartida del proxy de base:

```env
DB_HOST=192.168.0.100
DB_PORT=5432
```

La idea es:

- `PC2`: `HAProxy + keepalived` como principal
- `PC4`: `HAProxy + keepalived` como respaldo
- VIP compartida: `DB_PROXY_VIP`

Con eso:

- si `PC2` vive, la VIP queda en `PC2`
- si `PC2` cae completo, `PC4` toma la VIP
- la app sigue apuntando a la misma IP

### Configurar keepalived en PC2

```bash
env $(grep -v '^#' deploy/multi-host/multi-host.env | xargs) envsubst < deploy/multi-host/keepalived.db.pc2.conf.tmpl | sudo tee /etc/keepalived/keepalived.conf
sudo systemctl enable --now keepalived
```

### Configurar keepalived en PC4

```bash
env $(grep -v '^#' deploy/multi-host/multi-host.env | xargs) envsubst < deploy/multi-host/keepalived.db.pc4.conf.tmpl | sudo tee /etc/keepalived/keepalived.conf
sudo systemctl enable --now keepalived
```

### Validar la VIP

En `PC2` o `PC4`:

```bash
ip addr show | grep 192.168.0.100
```

Probar escritura por VIP:

```powershell
psql -h <DB_PROXY_VIP> -p 5432 -U fastorder_user -d fastorder_db -c "select pg_is_in_recovery();"
```

## 6. Verificacion

Revisar el rol de cada nodo:

```powershell
curl http://<PC1_IP>:8008
curl http://<PC2_IP>:8108
curl http://<PC3_IP>:8008
```

Probar escritura por la VIP del proxy:

```powershell
psql -h <DB_PROXY_VIP> -p 5432 -U fastorder_user -d fastorder_db -c "select pg_is_in_recovery();"
```

Probar lectura por proxy:

```powershell
psql -h <DB_PROXY_VIP> -p 5433 -U fastorder_user -d fastorder_db -c "select now();"
```

Ver backups en `PC1`:

```powershell
Get-ChildItem .\backups\postgres
docker logs -f fastorder-postgres-backup
```

Politica recomendada:

- backup logico frecuente cada `10` minutos
- retencion de `5` backups frecuentes

## Puertos por PC

- `PC1`
  - `2379` etcd client
  - `2380` etcd peer
  - `5432` PostgreSQL nodo 0
  - `8008` Patroni API nodo 0
- `PC2`
  - `2379` etcd client
  - `2380` etcd peer
  - `6432` PostgreSQL nodo 1
  - `8108` Patroni API nodo 1
  - `5432` HAProxy RW
  - `5433` HAProxy RO
  - `7000` stats HAProxy
- `PC3`
  - `2379` etcd client
  - `2380` etcd peer
  - `5432` PostgreSQL nodo 2
  - `8008` Patroni API nodo 2
- `PC4`
  - `5432` HAProxy RW
  - `5433` HAProxy RO
  - `7000` stats HAProxy
  - `9187` postgres-exporter proxy 2

## 7. Prueba de failover del proxy

1. Confirmar que la VIP esta en `PC2`.
2. Probar conexion a `DB_PROXY_VIP:5432`.
3. Apagar `PC2` o detener `keepalived`.
4. Confirmar que la VIP migro a `PC4`.
5. Repetir la conexion a `DB_PROXY_VIP:5432`.
