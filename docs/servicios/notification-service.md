# Notification Service

## 1. Objetivo del Servicio
El `notification-service` es responsable de registrar notificaciones relacionadas al ciclo de vida de los pedidos en FastOrder HA.  
En esta fase del proyecto, su alcance funcional cubre:
- Creación de notificaciones.
- Consulta de notificaciones por identificador.

Este servicio está diseñado para evolucionar a un consumidor de eventos de negocio vía RabbitMQ (por ejemplo, eventos de pedido creado, pedido en cocina, pedido en despacho o pedido entregado).

## 2. Contexto Arquitectónico
Dentro de la arquitectura distribuida, `notification-service` participa como un microservicio de soporte operacional y trazabilidad.

Relación con otros componentes:
- Entrada actual: API REST directa.
- Persistencia: PostgreSQL dedicado (`notification_db`).
- Mensajería: RabbitMQ configurado a nivel de aplicación para integración asíncrona posterior.

Principio aplicado:
- **Database per Service**: la base de datos de notificaciones es independiente del resto de microservicios.

## 3. Configuración Técnica
- Puerto HTTP del servicio: `8086`
- Base de datos: `notification_db`
- Puerto PostgreSQL en host: `5446`
- Driver: PostgreSQL JDBC
- Broker configurado: RabbitMQ (`5672`)
- Gestión y observabilidad básica: Spring Boot Actuator

## 4. Dependencias del Proyecto
Dependencias seleccionadas desde Spring Initializr (Spring Boot `3.5.14`, Java `21`, Maven):
- Spring Web
- Spring Data JPA
- PostgreSQL Driver
- Validation
- Spring Boot Actuator
- Lombok
- Spring for RabbitMQ

## 5. Diseño Interno (Estructura por Capas)
Implementación actual:
- `controller/NotificationController`
- `service/NotificationService`
- `repository/NotificationRepository`
- `entity/Notification`
- `dto/CreateNotificationRequest`
- `dto/NotificationResponse`
- `exception/NotificationNotFoundException`
- `exception/ApiErrorResponse`
- `exception/GlobalExceptionHandler`

Este diseño separa claramente transporte HTTP, lógica de negocio, acceso a datos y manejo transversal de errores.

## 6. Modelo de Datos
Archivo de inicialización: `database/notification-init.sql`

Tabla principal: `notifications`
- `id` BIGSERIAL PRIMARY KEY
- `order_id` BIGINT NOT NULL
- `channel` VARCHAR(30) NOT NULL
- `recipient` VARCHAR(150) NOT NULL
- `message` TEXT NOT NULL
- `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING'
- `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

Índices implementados:
- `idx_notifications_order_id`
- `idx_notifications_created_at`

Justificación:
- `order_id` optimiza búsquedas por pedido.
- `created_at` facilita consultas cronológicas y auditoría operativa.

## 7. API Implementada
### 7.1 Crear notificación
**Endpoint:** `POST /api/notifications`

Request JSON:
```json
{
  "orderId": 1001,
  "channel": "EMAIL",
  "recipient": "cliente@correo.com",
  "message": "Tu pedido fue recibido"
}
```

Respuesta esperada:
- `201 Created` con el objeto persistido.

### 7.2 Consultar notificación por ID
**Endpoint:** `GET /api/notifications/{id}`

Respuestas esperadas:
- `200 OK` cuando el recurso existe.
- `404 Not Found` cuando no existe el identificador solicitado.

## 8. Estrategia de Logging
Convención actual:
- `INFO`: operaciones exitosas de creación y consulta.
- `WARN`: solicitudes inválidas y recursos no encontrados.
- `ERROR`: excepciones no previstas.

Objetivo:
- Facilitar depuración funcional durante el checkpoint.
- Proveer trazabilidad mínima para pruebas y demo técnica.

## 9. Evidencia Funcional Actual
Pruebas manuales realizadas en Postman:
- `POST /api/notifications` con payload válido -> `201`.
- `GET /api/notifications/{id}` existente -> `200`.
- `POST` inválido -> `400` con mensaje descriptivo.
- `GET` inexistente -> `404` con mensaje descriptivo.

Estado de infraestructura validado:
- Contenedor `notification-db` operativo.
- Tabla `notifications` creada y accesible.
- Conexión JPA activa con validación de esquema.
