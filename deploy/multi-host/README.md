# Despliegue Multi-PC

Estos archivos reparten la base HA en 4 PCs:

- `PC1` (`192.168.0.2`): `etcd-0` + `fastorder-db-0`
- `PC2` (`192.168.0.5`): `etcd-1` + `fastorder-db-1` + `fastorder-db-proxy-1`
- `PC3` (`192.168.0.6`): `etcd-2` + `fastorder-db-2`
- `PC4` (`192.168.0.4`): `fastorder-db-proxy-2`

## Puertos

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

## Comandos

En `PC1`:

```powershell
docker compose -f deploy/multi-host/docker-compose.pc1.yml up -d --build
```

En `PC2`:

```powershell
docker compose -f deploy/multi-host/docker-compose.pc2.yml up -d --build
```

En `PC3`:

```powershell
docker compose -f deploy/multi-host/docker-compose.pc3.yml up -d --build
```

En `PC4`:

```powershell
docker compose -f deploy/multi-host/docker-compose.pc4.yml up -d --build
```

Observabilidad multi-host en la PC donde tengan Prometheus/Grafana:

```powershell
docker compose -f deploy/multi-host/docker-compose.observability.yml up -d
```

## App y backups

- La app puede apuntar a `192.168.0.5:5432` como proxy principal.
- Si el proxy de `PC2` cae, pueden cambiar a `192.168.0.4:5432`.
- El backup debería correr contra el proxy, no contra un nodo fijo.

Ejemplo:

```env
DB_HOST=192.168.0.5
DB_PORT=5432
```

## Verificación

Para ver el primario:

```powershell
curl http://192.168.0.2:8008
curl http://192.168.0.5:8108
curl http://192.168.0.6:8008
```

Para probar escritura por proxy principal:

```powershell
psql -h 192.168.0.5 -p 5432 -U fastorder_user -d fastorder_db -c "select pg_is_in_recovery();"
```

Para probar lectura por proxy:

```powershell
psql -h 192.168.0.5 -p 5433 -U fastorder_user -d fastorder_db -c "select now();"
```

## Grafana y Prometheus

- El archivo de Prometheus para multi-host es `monitoring/prometheus/prometheus.multi-host.yml`.
- Ese archivo ya scrapea:
  - `192.168.0.2:9187` nodo DB 0
  - `192.168.0.5:9188` nodo DB 1
  - `192.168.0.6:9187` nodo DB 2
  - `192.168.0.5:9189` proxy 1
  - `192.168.0.4:9187` proxy 2
  - APIs de Patroni en `8008/8108`
- El dashboard de Grafana quedó compatible tanto con el setup local anterior como con este multi-host.

## Nota sobre Keepalived

`keepalived` solo lo recomiendo si los proxies van en Linux nativo. Si van en Windows con Docker Desktop, mejor dejen:

- `PC2` como proxy principal
- `PC4` como proxy secundario
- y hagan el cambio manual de `DB_HOST` si se cae `PC2`
