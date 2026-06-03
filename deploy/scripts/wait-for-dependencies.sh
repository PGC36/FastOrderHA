#!/usr/bin/env bash
set -euo pipefail

wait_for_tcp() {
  local host="$1"
  local port="$2"
  local name="$3"
  local attempts="${4:-60}"
  local delay="${5:-2}"

  for ((i=1; i<=attempts; i++)); do
    if bash -lc "</dev/tcp/${host}/${port}" >/dev/null 2>&1; then
      echo "${name} listo en ${host}:${port}"
      return 0
    fi

    echo "Esperando ${name} en ${host}:${port} (${i}/${attempts})..."
    sleep "${delay}"
  done

  echo "No se pudo conectar a ${name} en ${host}:${port}" >&2
  return 1
}

if [[ -n "${DB_WAIT_HOST:-}" && -n "${DB_WAIT_PORT:-}" ]]; then
  wait_for_tcp "${DB_WAIT_HOST}" "${DB_WAIT_PORT}" "PostgreSQL"
fi

if [[ -n "${RABBIT_WAIT_HOST:-}" && -n "${RABBIT_WAIT_PORT:-}" ]]; then
  wait_for_tcp "${RABBIT_WAIT_HOST}" "${RABBIT_WAIT_PORT}" "RabbitMQ"
fi

exec "$@"
