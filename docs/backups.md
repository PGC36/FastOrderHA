# Backups de PostgreSQL

## Estrategia

FastOrder HA usa backups automaticos y restauracion manual controlada.

- Backup: automatico con `pg_dump`.
- Restauracion: manual para evitar sobrescribir datos validos por accidente.
- Frecuencia por defecto: cada 5 minutos.
- Retencion por defecto: ultimos 10 backups.
- Carpeta local: `backups/postgres`.
- Contenedor: `fastorder-postgres-backup`.
- Endpoint respaldado: `fastorder-db:5432` por medio de Pgpool.

La recuperacion automatica aplica a contenedores y failover. La restauracion de datos se mantiene manual porque requiere validar el punto de recuperacion correcto.

El backup no se toma desde un nodo PostgreSQL especifico. El contenedor `postgres-backup` apunta al endpoint unico `fastorder-db`, por lo que sigue funcionando aunque cambie el primario activo despues de un failover.

## Configuracion

El servicio `postgres-backup` en `docker-compose.yml` usa estas variables:

| Variable | Valor por defecto | Descripcion |
|---|---:|---|
| `PGHOST` | `fastorder-db` | Endpoint Pgpool de PostgreSQL |
| `PGPORT` | `5432` | Puerto interno |
| `PGDATABASE` | `fastorder_db` | Base a respaldar |
| `PGUSER` | `fastorder_user` | Usuario de backup |
| `PGPASSWORD` | `fastorder123` | Password del usuario |
| `BACKUP_INTERVAL_SECONDS` | `300` | Frecuencia entre backups |
| `BACKUP_RETENTION_COUNT` | `10` | Cantidad maxima de backups conservados |
| `BACKUP_DIR` | `/backups` | Ruta interna del contenedor |

## Comportamiento del worker

El script [`database/backup/backup.sh`](../database/backup/backup.sh) ejecuta un loop continuo con este comportamiento:

- crea un archivo temporal `.tmp` antes de dejar visible el `.sql` final;
- ejecuta `pg_dump` con `--clean` y `--if-exists` para que el dump incluya sentencias de borrado previo;
- usa `--no-owner` y `--no-privileges` para simplificar la restauracion local;
- si el dump falla, elimina el temporal y no deja archivos incompletos;
- al terminar, aplica retencion y elimina los backups mas antiguos que superen el limite configurado.

## Levantar el servicio de backups

Desde la raiz del proyecto:

```powershell
cd C:\ProyectoBDII\FastOrderHA
docker compose up -d postgres-backup
```

Ver logs:

```powershell
docker logs -f fastorder-postgres-backup
```

Listar archivos generados:

```powershell
Get-ChildItem .\backups\postgres
```

## Forzar un backup inmediato

El contenedor genera un backup al arrancar. Para forzar uno nuevo:

```powershell
docker restart fastorder-postgres-backup
```

Despues revisar:

```powershell
docker logs fastorder-postgres-backup --since 2m
Get-ChildItem .\backups\postgres
```

## Restauracion manual

Elegir un archivo de backup:

```powershell
Get-ChildItem .\backups\postgres | Sort-Object LastWriteTime -Descending
```

Antes de restaurar:

- detener `postgres-backup` para que no capture el estado danado;
- pausar `db-recovery` y los microservicios que todavia puedan escribir en la base;
- confirmar que el archivo elegido corresponde al punto de recuperacion correcto.

Restaurar sobre la base actual:

```powershell
Get-Content .\backups\postgres\fastorder_YYYYMMDDHHMMSS.sql | docker exec -i fastorder-db psql -U fastorder_user -d fastorder_db
```

Ejemplo:

```powershell
Get-Content .\backups\postgres\fastorder_20260509230000.sql | docker exec -i fastorder-db psql -U fastorder_user -d fastorder_db
```

Alternativa usada en pruebas, aislando la restauracion en un contenedor temporal conectado a la red de Docker Compose:

```powershell
docker run --rm --network fastorderha_fastorder-network -v ${PWD}/backups/postgres:/backups:ro -e PGPASSWORD=fastorder123 postgres:17-alpine psql -h fastorder-db -U fastorder_user -d fastorder_db -f /backups/fastorder_YYYYMMDDHHMMSS.sql
```

Validar despues de restaurar:

```powershell
node .\monitoring\check-results.js
```

Como el dump se genera con `--clean` y `--if-exists`, la restauracion reemplaza objetos existentes de la base actual. Por eso el procedimiento se mantiene manual y controlado.

## Prueba recomendada para demo

1. Levantar el entorno:

```powershell
docker compose up -d
```

2. Forzar un backup:

```powershell
docker restart fastorder-postgres-backup
```

3. Mostrar el archivo generado:

```powershell
Get-ChildItem .\backups\postgres
```

4. Mostrar logs del backup:

```powershell
docker logs fastorder-postgres-backup --since 2m
```

5. Explicar que la restauracion es manual y controlada para evitar perdida accidental de datos recientes.

## Prueba ejecutada

Se valido la restauracion manual con un caso controlado:

1. Se detuvo temporalmente `fastorder-postgres-backup` para evitar que guardara el estado danado.
2. Se confirmo que existia un backup valido:

```text
fastorder_20260510042221.sql
```

3. Se verifico el estado inicial:

```text
notifications=50000
orders=50000
```

4. Se simulo perdida de datos truncando la tabla `notifications`:

```powershell
docker exec -e PGPASSWORD=fastorder123 fastorder-db psql -h 127.0.0.1 -U fastorder_user -d fastorder_db -c "truncate table notifications restart identity;"
```

5. Se pausaron servicios de aplicacion y recuperacion automatica para restaurar sin escrituras concurrentes:

```powershell
docker stop fastorder-db-recovery fastorder-api-gateway fastorder-menu-service fastorder-inventory-service fastorder-order-service fastorder-kitchen-service fastorder-delivery-service fastorder-notification-service
```

6. Se restauro el backup desde un contenedor temporal de PostgreSQL conectado a la red del despliegue:

```powershell
docker run --rm --network fastorderha_fastorder-network -v ${PWD}/backups/postgres:/backups:ro -e PGPASSWORD=fastorder123 postgres:17-alpine psql -h fastorder-db -U fastorder_user -d fastorder_db -f /backups/fastorder_20260510042221.sql
```

7. Se levantaron nuevamente los servicios:

```powershell
docker compose up -d db-recovery postgres-backup api-gateway menu-service inventory-service order-service kitchen-service delivery-service notification-service
```

Resultado final:

```text
Orders: COMPLETED: 50000
Orders total: 50000
Idempotency keys unique: 50000
Outbox processed: 50000
Outbox pending: 0
Inventory: quantity=0, reserved=0, sold=50000
Inventory sales: 50000
Notifications: 50000
Rabbit queues: empty
Status: DONE
```

La prueba confirma que el backup permite recuperar datos borrados y volver a un estado consistente.

## Notas

- Los archivos `.sql` no se versionan en Git.
- El archivo `.gitkeep` conserva la carpeta `backups/postgres`.
- Para produccion real, los backups deberian copiarse tambien fuera del host, por ejemplo a almacenamiento externo.
