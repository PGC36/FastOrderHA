# FastOrderHA

FastOrder HA es un sistema de pedidos para restaurante construido con microservicios Spring Boot, Docker Compose, PostgreSQL HA, RabbitMQ, Redis, Prometheus, Grafana, k6 y backups automaticos.

## Estado actual

El proyecto ya cuenta con:

- API Gateway como entrada HTTP centralizada.
- Base PostgreSQL general `fastorder_db` para todos los dominios, con primary/standby y Pgpool.
- Redis para rate limiting con degradacion `fail-open`.
- Flujo de pedidos con patron Saga asincrono usando RabbitMQ.
- Workers por servicio para procesar eventos en paralelo.
- Idempotencia en creacion de ordenes.
- Compensacion de inventario cuando una orden falla antes de cocina.
- Reintentos de delivery sin devolver inventario cuando la comida ya fue preparada.
- Notificaciones consumidas desde `notification.created.queue`.
- Observabilidad con Prometheus, Grafana, cAdvisor y metricas de RabbitMQ.
- Backups automaticos de PostgreSQL con restauracion manual validada.
- Pruebas k6 para carga minima de 50k, carga sostenida, picos y caos.

## Documentos principales

- [Arquitectura](./arquitectura.md)
- [Docker Compose](./docker-compose.md)
- [Deployment](./deployment.md)
- [Base de datos](./database.md)
- [Backups](./backups.md)
- [Pruebas de carga con k6](./load-testing-k6.md)
- [Pruebas realizadas](./pruebas-realizadas.md)
- [Guia de caos en base de datos](./guia-pruebas-caos-bd.md)
- [API Gateway](./api/api-gateway.md)
- [Endpoints](./api/endpoints.md)

## Servicios

- [Menu Service](./servicios/menu-service.md)
- [Inventory Service](./servicios/inventory-service.md)
- [Order Service](./servicios/order-service.md)
- [Kitchen Service](./servicios/kitchen-service.md)
- [Delivery Service](./servicios/delivery-service.md)
- [Notification Service](./servicios/notification-service.md)

## Accesos locales

| Componente | URL |
|---|---|
| API Gateway | `http://localhost:8080` |
| RabbitMQ Management | `http://localhost:15672` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3000` |
| cAdvisor | `http://localhost:8087` |

RabbitMQ usa `guest / guest`.

Grafana usa `admin / admin` en el primer acceso local.
