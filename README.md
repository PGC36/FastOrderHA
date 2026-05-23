# FastOrder HA

FastOrder HA es una plataforma distribuida de pedidos para restaurante construida con microservicios Spring Boot, Docker Compose, PostgreSQL HA, RabbitMQ, Prometheus, Grafana y k6.

El objetivo del proyecto es demostrar alta disponibilidad, tolerancia a fallos, consistencia de datos, observabilidad, backups y pruebas de carga/caos sobre una operacion critica: la creacion y procesamiento de pedidos.

## Estado del proyecto

El sistema ya cuenta con:

- API Gateway como punto de entrada unico.
- Seis microservicios de negocio: menu, pedidos, inventario, cocina, delivery y notificaciones.
- PostgreSQL como base de datos principal con Patroni, etcd y HAProxy.
- RabbitMQ para comunicacion asincrona entre servicios.
- Saga de pedidos basada en eventos.
- Outbox pattern en `order-service`.
- Idempotencia en creacion de ordenes.
- Reintentos ante errores transitorios.
- Failover de base de datos coordinado por Patroni y etcd.
- Recuperacion automatica de contenedores de BD mediante `db-recovery`.
- Monitoreo con Prometheus, Grafana, cAdvisor y metricas de RabbitMQ.
- Backups automaticos con `pg_dump` y restauracion manual documentada.
- Pruebas k6 de 50,000 peticiones, carga sostenida, picos y caos.

## Arquitectura

```text
Cliente / k6 / Postman
        |
        v
API Gateway
        |
        v
Microservicios Spring Boot
        |
        +--> PostgreSQL HA: Patroni + etcd + HAProxy
        |
        +--> RabbitMQ: eventos de la Saga
        |
        +--> Prometheus / Grafana / cAdvisor
```

Servicios principales:

| Servicio | Responsabilidad | Puerto local |
|---|---|---:|
| `api-gateway` | Entrada HTTP | `8080` |
| `menu-service` | Catalogo de productos | `8081` |
| `order-service` | Ordenes, idempotencia y outbox | `8082` |
| `inventory-service` | Reserva, venta y compensacion de inventario | `8083` |
| `kitchen-service` | Preparacion de ordenes | `8084` |
| `delivery-service` | Flujo de entrega | `8085` |
| `notification-service` | Registro de notificaciones | `8086` |
| `fastorder-db` | HAProxy hacia PostgreSQL HA | `5440` |
| `rabbitmq` | Broker de eventos | `5672`, `15672` |
| `prometheus` | Metricas | `9090` |
| `grafana` | Dashboards | `3000` |
| `cadvisor` | Metricas de contenedores | `8087` |

## Estructura

```text
FastOrderHA/
|-- api-gateway/
|-- menu-service/
|-- inventory-service/
|-- order-service/
|-- kitchen-service/
|-- delivery-service/
|-- notification-service/
|-- database/
|-- monitoring/
|-- backups/
|-- docs/
`-- docker-compose.yml
```

## Requisitos

- Docker Desktop.
- Docker Compose.
- Node.js para ejecutar scripts de verificacion.
- k6 para pruebas de carga.
- PowerShell en Windows.

## Levantar el proyecto

Desde la raiz del repositorio:

```powershell
cd C:\ProyectoBDII\FastOrderHA
docker compose up -d
```

Tambien pueden usar la version separada por responsabilidad:

```powershell
docker compose -f .\docker-compose.infra-db.yml -f .\docker-compose.infra-mq.yml up -d
docker compose -f .\docker-compose.app.yml up -d
docker compose -f .\docker-compose.observability.yml up -d
```

Archivos recomendados:

- `docker-compose.infra-db.yml`: PostgreSQL HA con Patroni, etcd, HAProxy, `db-recovery`, backups y exporters de BD.
- `docker-compose.infra-mq.yml`: RabbitMQ y recuperacion de DLQ.
- `docker-compose.app.yml`: API Gateway y microservicios.
- `docker-compose.observability.yml`: Prometheus, Grafana, cAdvisor y exporter de Docker.

Ver contenedores:

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Verificar el estado funcional:

```powershell
node .\monitoring\check-results.js
```

## Accesos locales

| Componente | URL | Credenciales |
|---|---|---|
| API Gateway | `http://localhost:8080` | N/A |
| RabbitMQ Management | `http://localhost:15672` | `guest / guest` |
| Prometheus | `http://localhost:9090` | N/A |
| Grafana | `http://localhost:3000` | `admin / admin` |
| cAdvisor | `http://localhost:8087` | N/A |
| PostgreSQL via HAProxy | `localhost:5440` | `fastorder_user / fastorder123` |

## Endpoints principales

Todos los endpoints funcionales se consumen desde el API Gateway.

| Metodo | Endpoint | Uso |
|---|---|---|
| `GET` | `/api/menu/productos` | Consultar productos |
| `GET` | `/api/inventory/check?productId=1&quantity=1` | Consultar disponibilidad de inventario |
| `POST` | `/api/orders` | Crear pedido |
| `GET` | `/api/orders` | Consultar pedidos |
| `GET` | `/api/orders/{id}` | Consultar pedido por ID |
| `GET` | `/api/notifications/{id}` | Consultar notificacion por ID |

Ejemplo de creacion de pedido:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8080/api/orders `
  -ContentType "application/json" `
  -Body '{"productId":1,"quantity":1,"deliveryAddress":"Demo address","idempotencyKey":"demo-001"}'
```

## Flujo critico

La operacion critica es `POST /api/orders`.

1. `order-service` crea la orden con `idempotencyKey` unica.
2. Guarda `order.created` en `outbox_events`.
3. El publisher de outbox publica el evento a RabbitMQ.
4. `inventory-service` reserva stock o rechaza por falta de inventario.
5. `kitchen-service` prepara la orden cuando el inventario fue reservado.
6. `delivery-service` procesa la entrega.
7. `order-service` marca la orden como `COMPLETED`.
8. `inventory-service` confirma venta y descuenta inventario.
9. `notification-service` registra la notificacion.

## Consistencia

El sistema protege las reglas de negocio con:

- `idempotencyKey` unica para evitar pedidos duplicados.
- Restricciones unicas en tablas criticas como `orders`, `inventory_sales`, `kitchen_orders`, `delivery_orders` y `notifications`.
- Outbox pattern para no perder eventos despues de crear pedidos.
- Saga asincrona con eventos RabbitMQ.
- Reintentos en consumers ante fallos tecnicos.
- Compensacion de inventario cuando una orden se cancela antes de cocina.
- Control de estados para evitar transiciones invalidas.
- Reconciliacion automatica de notificaciones faltantes.

## Alta disponibilidad

La solucion tolera:

- Caida de microservicios.
- Caida del proxy HA de base de datos.
- Caida del nodo primary de PostgreSQL.
- Caida temporal de consumers de eventos.

La promocion del lider la coordina Patroni. `db-recovery` queda como apoyo operativo para volver a levantar contenedores de BD caidos durante pruebas de caos o `docker kill`.

## Backups

El servicio `postgres-backup` ejecuta `pg_dump` automaticamente.

- Frecuencia: cada 5 minutos.
- Retencion: ultimos 10 backups.
- Carpeta: `backups/postgres`.
- Restauracion: manual y controlada.

Ver backups:

```powershell
Get-ChildItem .\backups\postgres
```

Ver logs:

```powershell
docker logs -f fastorder-postgres-backup
```

La guia completa esta en [docs/backups.md](docs/backups.md).

## Pruebas de carga

Prueba principal de 50,000 pedidos:

```powershell
k6 run .\monitoring\k6\order-write-test.js
```

Prueba resiliente recomendada para caos:

```powershell
$env:TOTAL_ORDERS='50000'
$env:VUS='100'
$env:MAX_DURATION='30m'
$env:MAX_ATTEMPTS='150'
$env:RETRY_DELAY_SECONDS='2'
$env:REQUEST_TIMEOUT='5s'
$env:ITERATION_DELAY_SECONDS='0.2'
$env:RUN_ID='demo-' + (Get-Date -Format 'yyyyMMddHHmmss')
k6 run .\monitoring\k6\order-write-resilient-test.js
```

Ver resultado final:

```powershell
node .\monitoring\check-results.js
```

El resultado esperado con inventario exacto de 50,000 unidades:

```text
Orders: COMPLETED: 50000
Outbox pending: 0
Inventory: quantity=0, reserved=0, sold=50000
Notifications: 50000
Rabbit queues: empty
Status: DONE
```

La guia completa esta en [docs/load-testing-k6.md](docs/load-testing-k6.md).

## Pruebas de caos validadas

Se validaron escenarios como:

- 50k pedidos sin errores HTTP.
- 50k pedidos con inventario insuficiente.
- Caida de un microservicio durante carga.
- Caida de varios microservicios durante carga.
- Caida del primary de PostgreSQL durante insercion.
- Prueba extrema con 50k, dos caidas de BD y caida escalonada de cinco servicios.
- Borrado de datos y restauracion manual desde backup.

Resultados documentados en [docs/pruebas-realizadas.md](docs/pruebas-realizadas.md).

## Observabilidad

Grafana ya carga dashboards desde:

```text
monitoring/grafana/dashboards/
```

Dashboard disponible:

```text
fastorder-overview.json
```

Metricas revisadas:

- throughput y latencia de peticiones.
- errores HTTP.
- CPU y memoria por contenedor.
- estado de colas RabbitMQ.
- mensajes Ready y Unacked.
- estado de targets Prometheus.
- JVM de servicios Spring Boot.

## Documentacion

| Documento | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Arquitectura, componentes, Saga y eventos |
| [docs/database.md](docs/database.md) | Modelo de datos y PostgreSQL HA |
| [docs/docker-compose.md](docs/docker-compose.md) | Detalle del despliegue Docker Compose |
| [docs/load-testing-k6.md](docs/load-testing-k6.md) | Guia de pruebas k6 y caos |
| [docs/backups.md](docs/backups.md) | Backups y restauracion |
| [docs/pruebas-realizadas.md](docs/pruebas-realizadas.md) | Evidencia tecnica de pruebas ejecutadas |
| [docs/guia-pruebas-caos-bd.md](docs/guia-pruebas-caos-bd.md) | Guia especifica de caos en BD |
| [docs/api/api-gateway.md](docs/api/api-gateway.md) | API Gateway |

## Estado final

El sistema cumple los requisitos tecnicos principales de la entrega:

- Alta disponibilidad en capa de aplicacion.
- Replicacion y failover de base de datos.
- Mensajeria asincrona.
- Consistencia eventual.
- Observabilidad.
- Pruebas de carga de 50,000 peticiones.
- Pruebas de caos.
- Backups automaticos y restauracion validada.

Pendiente para la entrega final:

- Capturas de evidencia para el PDF.
- Video/demo de 5 a 8 minutos.
- Exportar o adjuntar dashboard de Grafana si se solicita como entregable.
