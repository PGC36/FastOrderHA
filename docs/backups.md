# Backups de PostgreSQL

## Estrategia

FastOrder HA usa backups automaticos con `pg_dump` y restauracion manual controlada.

- Backup: automatico.
- Restauracion: manual.
- Frecuencia por defecto: cada 5 minutos.
- Retencion por defecto: ultimos 10 backups.
- Carpeta local: `backups/postgres`.
- Contenedor: `fastorder-postgres-backup`.
- Endpoint respaldado: `fastorder-db:5432` por medio de `HAProxy`.

El backup apunta al endpoint unico `fastorder-db`, no a un nodo fijo. Por eso sigue funcionando aunque Patroni cambie el lider despues de un failover.

## Configuracion

El servicio `postgres-backup` usa estas variables:

| Variable | Valor por defecto | Descripcion |
|---|---:|---|
| `PGHOST` | `fastorder-db` | Endpoint unico de PostgreSQL |
| `PGPORT` | `5432` | Puerto interno |
| `PGDATABASE` | `fastorder_db` | Base a respaldar |
| `PGUSER` | `postgres` | Usuario usado por el contenedor de backup |
| `PGPASSWORD` | `fastorder123` | Password del usuario |
| `BACKUP_INTERVAL_SECONDS` | `300` | Frecuencia entre backups |
| `BACKUP_RETENTION_COUNT` | `10` | Cantidad maxima de backups conservados |
| `BACKUP_DIR` | `/backups` | Ruta interna del contenedor |

## Comportamiento del worker

El script [`database/backup/backup.sh`](../database/backup/backup.sh) ejecuta un loop continuo con este comportamiento:

- crea un archivo temporal `.tmp` antes de publicar el `.sql` final;
- ejecuta `pg_dump` con `--clean` y `--if-exists`;
- usa `--no-owner` y `--no-privileges` para simplificar restauraciones locales;
- si el dump falla, elimina el temporal y no deja archivos incompletos;
- al terminar, aplica retencion y elimina los backups mas antiguos.

## Levantar el servicio de backups

```powershell
cd C:\ProyectoBDII\FastOrderHA
docker compose up -d postgres-backup
```

Ver logs:

```powershell
docker logs -f fastorder-postgres-backup
```

Listar archivos:

```powershell
Get-ChildItem .\backups\postgres
```

## Forzar un backup inmediato

```powershell
docker restart fastorder-postgres-backup
```

Luego revisar:

```powershell
docker logs fastorder-postgres-backup --since 2m
Get-ChildItem .\backups\postgres
```

## Restauracion manual

Antes de restaurar:

- detener `postgres-backup` para no capturar el estado danado;
- pausar `db-recovery` y los microservicios con escritura;
- confirmar que el archivo elegido corresponde al punto de recuperacion correcto.

Elegir un archivo:

```powershell
Get-ChildItem .\backups\postgres | Sort-Object LastWriteTime -Descending
```

Restaurar sobre la base actual:

```powershell
Get-Content .\backups\postgres\fastorder_YYYYMMDDHHMMSS.sql | docker exec -i fastorder-db psql -U postgres -d fastorder_db
```

Alternativa con contenedor temporal:

```powershell
docker run --rm --network fastorderha_fastorder-network -v ${PWD}/backups/postgres:/backups:ro -e PGPASSWORD=fastorder123 postgres:17-alpine psql -h fastorder-db -U postgres -d fastorder_db -f /backups/fastorder_YYYYMMDDHHMMSS.sql
```

Validar despues:

```powershell
node .\monitoring\check-results.js
```

## Prueba validada

Se valido una restauracion real con este flujo:

1. detener temporalmente `fastorder-postgres-backup`;
2. confirmar un backup valido en `backups/postgres`;
3. simular dano sobre `notifications`;
4. pausar `db-recovery` y microservicios;
5. restaurar el dump contra `fastorder-db`;
6. levantar nuevamente el stack y verificar consistencia.

La restauracion devolvio el sistema a un estado consistente, con `Status: DONE`, colas vacias y conteos correctos en `orders`, `inventory_sales` y `notifications`.

## Notas

- Los archivos `.sql` no se versionan en Git.
- `.gitkeep` conserva la carpeta `backups/postgres`.
- Para una entrega entre varias PCs, conviene copiar estos backups tambien fuera del host local.
