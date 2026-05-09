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

La prueba de falla inducida por eliminacion de contenedores queda pendiente para la etapa de replicas y backups.

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
k6 run .\monitoring\k6\order-write-test.js
```

## Carga sostenida

```powershell
k6 run .\monitoring\k6\sustained-write-test.js
```

## Pico de escritura

```powershell
k6 run .\monitoring\k6\spike-write-test.js
```

## Ver resultado de negocio

```powershell
node .\monitoring\check-results.js
```

Para ver el drenaje asincrono en vivo:

```powershell
node .\monitoring\check-results.js --watch
```

## Resultado de referencia

Prueba completa registrada antes de replicas y backups con stock suficiente:

| Metrica | Resultado |
|---|---:|
| Ordenes enviadas | `50,000` |
| Metodo | `POST /api/orders` |
| Duracion de envio k6 | `26.0 s` |
| Throughput aproximado | `1,924 req/s` |
| Tasa de error HTTP | `0%` |
| Checks k6 | `100%` |
| Latencia promedio | `103.6 ms` |
| Latencia p95 | `257.15 ms` |
| Latencia p99 | `366.16 ms` |
| Latencia maxima | `1.65 s` |
| Ordenes finales `COMPLETED` | `50,010` acumuladas |
| Inventario `reserved` | `0` |
| Inventario `sold` | `50,010` |
| Notificaciones finales | `50,010` |
| Tiempo hasta completar la saga | aprox. `9 min 30 s` |

## Resultado con inventario insuficiente

Tambien se valido el caso donde entran 50,000 solicitudes adicionales sin stock suficiente. El sistema acepto la carga, no sobrevendio y cancelo lo que no podia cumplir.

| Metrica | Resultado |
|---|---:|
| Ordenes totales acumuladas | `100,010` |
| Ordenes finales `COMPLETED` | `60,000` |
| Ordenes finales `CANCELLED` | `40,010` |
| Outbox procesado | `100,010` |
| Inventario `quantity` | `0` |
| Inventario `reserved` | `0` |
| Inventario `sold` | `60,000` |
| `inventory_sales` | `60,000` |
| RabbitMQ Ready/Unacked | `0` |

## Como validar que todo completo

```powershell
node .\monitoring\check-results.js
```

El resultado esperado para una prueba 50k con stock suficiente es:

- `orders`: 50,000 en `COMPLETED`.
- `notifications`: 50,000 registros.
- `inventory.reserved`: 0.
- `inventory.sold`: 50,000.
- `outbox.pending`: 0.
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

- replicas de servicios consumidores.
- backups y estrategia de recuperacion.
- pruebas de caos matando contenedores.
- tuning de base de datos y RabbitMQ bajo carga real.

Redis ya esta integrado en el API Gateway para rate limiting. El limite por defecto permite esta prueba de 50,000 peticiones; si se baja `API_RATE_LIMIT_CAPACITY`, k6 puede recibir respuestas `429` por exceso de trafico.
