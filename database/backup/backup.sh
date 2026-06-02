#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-300}"
BACKUP_RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-10}"
BACKUP_TIMEOUT_SECONDS="${BACKUP_TIMEOUT_SECONDS:-240}"

mkdir -p "$BACKUP_DIR"

echo "PostgreSQL backup worker started"
echo "Target: ${PGHOST}:${PGPORT}/${PGDATABASE}"
echo "Interval seconds: ${BACKUP_INTERVAL_SECONDS}"
echo "Retention count: ${BACKUP_RETENTION_COUNT}"
echo "Backup timeout seconds: ${BACKUP_TIMEOUT_SECONDS}"

cleanup_stale_tmp_files() {
  find "$BACKUP_DIR" -maxdepth 1 -name 'fastorder_*.sql.tmp' -type f | while IFS= read -r stale_file; do
    echo "Removing stale temp backup ${stale_file}"
    rm -f "$stale_file"
  done
}

create_backup() {
  file="$1"
  tmp_file="$2"

  echo "Creating backup ${file}"

  if command -v timeout >/dev/null 2>&1; then
    if timeout "$BACKUP_TIMEOUT_SECONDS" pg_dump \
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
    backup_exit_code=$?
  else
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
    backup_exit_code=$?
  fi

  if [ "${backup_exit_code}" -eq 124 ]; then
    echo "Backup timed out after ${BACKUP_TIMEOUT_SECONDS}s"
  else
    echo "Backup failed with exit code ${backup_exit_code}"
  fi

  rm -f "$tmp_file"
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

cleanup_stale_tmp_files

while true; do
  timestamp="$(date +%Y%m%d%H%M%S)"
  file="${BACKUP_DIR}/fastorder_${timestamp}.sql"
  tmp_file="${file}.tmp"

  create_backup "$file" "$tmp_file" || true
  apply_retention "${BACKUP_DIR}/fastorder_*.sql" "$BACKUP_RETENTION_COUNT"

  sleep "$BACKUP_INTERVAL_SECONDS"
done
