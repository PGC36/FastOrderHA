#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-300}"
BACKUP_RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-10}"

mkdir -p "$BACKUP_DIR"

echo "PostgreSQL backup worker started"
echo "Target: ${PGHOST}:${PGPORT}/${PGDATABASE}"
echo "Interval seconds: ${BACKUP_INTERVAL_SECONDS}"
echo "Retention count: ${BACKUP_RETENTION_COUNT}"

create_backup() {
  file="$1"
  tmp_file="$2"

  echo "Creating backup ${file}"

  if pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    > "$tmp_file"; then
    mv "$tmp_file" "$file"
    echo "Backup completed: ${file}"
    return 0
  fi

  rm -f "$tmp_file"
  echo "Backup failed"
  return 1
}

apply_retention() {
  pattern="$1"
  retention="$2"

  if [ "$retention" -gt 0 ]; then
    old_files="$(ls -1t ${pattern} 2>/dev/null | tail -n +"$((retention + 1))" || true)"
    if [ -n "$old_files" ]; then
      echo "$old_files" | while IFS= read -r old_file; do
        echo "Removing old backup ${old_file}"
        rm -f "$old_file"
      done
    fi
  fi
}

while true; do
  timestamp="$(date +%Y%m%d%H%M%S)"
  file="${BACKUP_DIR}/fastorder_${timestamp}.sql"
  tmp_file="${file}.tmp"

  create_backup "$file" "$tmp_file" || true
  apply_retention "${BACKUP_DIR}/fastorder_*.sql" "$BACKUP_RETENTION_COUNT"

  sleep "$BACKUP_INTERVAL_SECONDS"
done
