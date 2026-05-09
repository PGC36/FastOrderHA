# Pruebas de carga con k6

## Objetivo

Validar los requisitos de rendimiento del proyecto:

- carga minima de 50,000 peticiones.
- carga concurrente sostenida.
- picos de trafico.
- throughput.
- latencia promedio.
- latencia p95 y p99.
- tasa de error.
- CPU y memoria mediante Grafana.

La prueba de falla inducida por eliminacion de contenedores queda pendiente para la etapa de replicas, Redis y backups.

## Scripts disponibles

| Script | Tipo | Descripcion |
|---|---|---|
| `monitoring/k6/order-write-test.js` | Escritura 50k | Crea ordenes reales por `POST /api/orders` |
| `monitoring/k6/sustained-write-test.js` | Escritura sostenida | Mantiene una tasa constante de ordenes |
| `monitoring/k6/spike-write-test.js` | Pico de escritura | Lanza un pico fuerte de ordenes por pocos segundos |
| `monitoring/k6/read-stress.js` | Lectura | Consulta endpoints del gateway |
| `monitoring/k6/one-second-spike.js` | Pico de lectura | Intenta un pico extremo de lecturas |

## Prueba 50k de escritura

```powershell
$runId = "50k-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network `
  -v "${PWD}\monitoring\k6:/scripts" `
  -e TOTAL_ORDERS=50000 `
  -e VUS=200 `
  -e MAX_DURATION=30s `
  -e RUN_ID=$runId `
  grafana/k6:0.54.0 run /scripts/order-write-test.js
```

## Carga sostenida

```powershell
$runId = "sustained-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network `
  -v "${PWD}\monitoring\k6:/scripts" `
  -e RATE=250 `
  -e DURATION=5m `
  -e RUN_ID=$runId `
  grafana/k6:0.54.0 run /scripts/sustained-write-test.js
```

## Pico de escritura

```powershell
$runId = "spike-" + (Get-Date -Format "yyyyMMddHHmmss")
docker run --rm --network fastorderha_fastorder-network `
  -v "${PWD}\monitoring\k6:/scripts" `
  -e RATE=5000 `
  -e DURATION=10s `
  -e RUN_ID=$runId `
  grafana/k6:0.54.0 run /scripts/spike-write-test.js
```

## Resultado de referencia

Ultima prueba completa registrada antes de Redis, replicas y backups:

| Metrica | Resultado |
|---|---:|
| Ordenes enviadas | `50,000` |
| Metodo | `POST /api/orders` |
| Duracion de envio k6 | `25.7 s` |
| Throughput aproximado | `1,943 req/s` |
| Tasa de error HTTP | `0%` |
| Checks k6 | `100%` |
| Latencia promedio | `102.41 ms` |
| Latencia p95 | `248.6 ms` |
| Latencia p99 | `359.96 ms` |
| Latencia maxima | `828.58 ms` |
| Ordenes finales `COMPLETED` | `50,000` |
| Notificaciones finales | `50,000` |
| Tiempo hasta completar la saga | aprox. `7 min 10 s` |

## Como validar que todo completo

```powershell
docker exec fastorder-db psql -U fastorder_user -d fastorder_db -c "select status, count(*) from orders group by status order by status;"
docker exec fastorder-db psql -U fastorder_user -d fastorder_db -c "select count(*) from notifications;"
```

El resultado esperado para la prueba 50k es:

- `orders`: 50,000 en `COMPLETED`.
- `notifications`: 50,000 registros.
- RabbitMQ sin acumulacion permanente en las colas principales.

## Grafana

Las metricas operativas se revisan en:

```text
http://localhost:3000
```

Paneles importantes:

- CPU por contenedor desde cAdvisor.
- Memoria por contenedor desde cAdvisor.
- Estado de targets Prometheus.
- Colas RabbitMQ por nombre.
- Mensajes Ready/Unacked.
- JVM CPU y memoria por servicio Spring.
- Latencia y conteo HTTP de servicios.

## Interpretacion actual

El sistema cumple la prueba minima de 50,000 peticiones de escritura sin errores HTTP y sin perdida de ordenes. La parte que mas tarda no es aceptar la orden, sino procesar toda la saga hasta `COMPLETED`.

Para mejorar el tiempo total de cierre de ordenes, los siguientes pasos serian:

- Redis para lecturas/cache donde aplique.
- replicas de servicios consumidores.
- backups y estrategia de recuperacion.
- pruebas de caos matando contenedores.
- tuning de base de datos y RabbitMQ bajo carga real.
