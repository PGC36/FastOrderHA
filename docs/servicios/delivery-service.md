# Delivery Service

## Resumen

`delivery-service` es el microservicio encargado de gestionar entregas dentro de FastOrder HA.

Actualmente ya existe una base funcional implementada con:

- Spring Boot
- API REST
- PostgreSQL
- JPA
- validaciones
- Actuator
- métricas Prometheus

## Estado actual implementado

Hasta este punto ya quedó creado:

- paquete base `com.fastorder.delivery`
- estructura por capas
- entidad principal `DeliveryOrder`
- entidad de trazabilidad `DeliveryStatusHistory`
- DTOs de entrada y salida
- repositorios JPA
- lógica de negocio
- controlador REST
- manejo global de excepciones
- configuración `application.yaml`
- script SQL consolidado en `database/fastorder-init.sql`
- test base de contexto

## Responsabilidad del servicio

El servicio actualmente permite:

- crear entregas a partir de un pedido
- consultar entregas por ID
- consultar entregas por `orderId`
- asignar repartidor
- marcar recogida
- marcar en tránsito
- marcar entrega como completada
- marcar entrega como fallida
- cancelar entrega
- evitar duplicados por `order_id`
- exponer health check
- exponer métricas para Prometheus

## Estados implementados

Los estados definidos e implementados son:

- `PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

## Estructura actual

```text
delivery-service/
├── pom.xml
├── mvnw
├── mvnw.cmd
├── HELP.md
└── src/
    ├── main/
    │   ├── java/com/fastorder/delivery/
    │   │   ├── DeliveryServiceApplication.java
    │   │   ├── controller/
    │   │   │   └── DeliveryController.java
    │   │   ├── dto/
    │   │   │   ├── request/
    │   │   │   │   ├── AssignDriverRequest.java
    │   │   │   │   ├── CancelDeliveryRequest.java
    │   │   │   │   ├── CreateDeliveryRequest.java
    │   │   │   │   └── FailDeliveryRequest.java
    │   │   │   └── response/
    │   │   │       ├── DeliveryResponse.java
    │   │   │       └── DeliveryStatusHistoryResponse.java
    │   │   ├── enums/
    │   │   │   └── DeliveryStatus.java
    │   │   ├── exception/
    │   │   │   ├── DeliveryAlreadyExistsException.java
    │   │   │   ├── DeliveryConflictException.java
    │   │   │   ├── DeliveryNotFoundException.java
    │   │   │   ├── GlobalExceptionHandler.java
    │   │   │   └── InvalidDeliveryStatusException.java
    │   │   ├── model/
    │   │   │   ├── DeliveryOrder.java
    │   │   │   └── DeliveryStatusHistory.java
    │   │   ├── repository/
    │   │   │   ├── DeliveryOrderRepository.java
    │   │   │   └── DeliveryStatusHistoryRepository.java
    │   │   └── service/
    │   │       └── DeliveryOrderService.java
    │   └── resources/
    │       └── application.yaml
    └── test/
        └── java/com/fastorder/delivery/
            └── DeliveryServiceApplicationTests.java
```

## Dependencias configuradas

En `pom.xml` están configuradas estas dependencias:

- `spring-boot-starter-web`
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-validation`
- `spring-boot-starter-actuator`
- `spring-boot-starter-amqp`
- `io.micrometer:micrometer-registry-prometheus`
- `org.postgresql:postgresql`
- `org.projectlombok:lombok`
- `spring-boot-starter-test`
- `spring-rabbit-test`

Adicionalmente:

- Java `21`
- empaquetado JAR

## Configuración actual

Archivo: [application.yaml](../../delivery-service/src/main/resources/application.yaml)

```yaml
spring:
  application:
    name: delivery-service
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5440/fastorder_db}
    username: ${SPRING_DATASOURCE_USERNAME:fastorder_user}
    password: ${SPRING_DATASOURCE_PASSWORD:fastorder123}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    properties:
      hibernate:
        format_sql: true

server:
  port: 8085

management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  endpoint:
    health:
      show-details: always
```

## Base de datos utilizada

El servicio usa la base general `fastorder_db` y el script consolidado:

- [fastorder-init.sql](../../database/fastorder-init.sql)

Contrato SQL actual:

```sql
CREATE TABLE IF NOT EXISTS delivery_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (
        status IN (
            'PENDING',
            'ASSIGNED',
            'PICKED_UP',
            'IN_TRANSIT',
            'DELIVERED',
            'FAILED',
            'CANCELLED'
        )
    ),
    assigned_driver_id BIGINT,
    delivery_address VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    in_transit_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancel_reason VARCHAR(255),
    failure_reason VARCHAR(255),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_status
ON delivery_orders(status);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_assigned_driver_id
ON delivery_orders(assigned_driver_id);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at
ON delivery_orders(created_at);

CREATE TABLE IF NOT EXISTS delivery_status_history (
    id BIGSERIAL PRIMARY KEY,
    delivery_order_id BIGINT NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason VARCHAR(255),
    changed_by VARCHAR(100),
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_delivery_status_history_order
        FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_order_id
ON delivery_status_history(delivery_order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_changed_at
ON delivery_status_history(changed_at);
```

Decisiones aplicadas:

- `order_id` es único
- las tablas del dominio de delivery viven junto al resto de dominios en `fastorder_db`
- el historial entra desde la primera fase
- Hibernate solo valida el esquema con `ddl-auto: validate`

## Integracion con RabbitMQ

El servicio tiene Spring AMQP configurado y declara:

- exchange: `delivery.exchange`
- cola: `delivery.events.queue`
- routing key: `delivery.event`

## Modelo implementado

### Entidad principal: `DeliveryOrder`

Campos implementados:

- `id`
- `orderId`
- `status`
- `assignedDriverId`
- `deliveryAddress`
- `createdAt`
- `updatedAt`
- `assignedAt`
- `pickedUpAt`
- `inTransitAt`
- `deliveredAt`
- `failedAt`
- `cancelledAt`
- `cancelReason`
- `failureReason`
- `version`

Comportamiento implementado:

- `@PrePersist` asigna timestamps base y estado `PENDING` por defecto
- `@PreUpdate` actualiza `updatedAt`
- `@Version` protege concurrencia optimista

### Entidad de historial: `DeliveryStatusHistory`

Campos implementados:

- `id`
- `deliveryOrder`
- `previousStatus`
- `newStatus`
- `reason`
- `changedBy`
- `changedAt`

Decisión aplicada:

- relación `ManyToOne(fetch = FetchType.LAZY)` hacia `DeliveryOrder`

## DTOs implementados

Se crearon estos DTOs:

### Request

- `CreateDeliveryRequest`
- `AssignDriverRequest`
- `FailDeliveryRequest`
- `CancelDeliveryRequest`

### Response

- `DeliveryResponse`
- `DeliveryStatusHistoryResponse`

Validaciones implementadas:

- `orderId` obligatorio y positivo
- `deliveryAddress` obligatorio
- `driverId` obligatorio y positivo
- `reason` obligatorio en fallo y cancelación
- límites de longitud con `@Size`

## Repositorios implementados

### `DeliveryOrderRepository`

Métodos principales:

- `findByOrderId(Long orderId)`
- `existsByOrderId(Long orderId)`
- `findByStatus(DeliveryStatus status)`
- `findByAssignedDriverId(Long driverId)`

### `DeliveryStatusHistoryRepository`

Método principal:

- `findByDeliveryOrderIdOrderByChangedAtAsc(Long deliveryOrderId)`

## Manejo de errores implementado

Se implementó:

- `DeliveryNotFoundException`
- `DeliveryAlreadyExistsException`
- `InvalidDeliveryStatusException`
- `DeliveryConflictException`
- `GlobalExceptionHandler`

Mapeo actual:

- `400` para errores de validación
- `404` para entrega no encontrada
- `409` para conflicto de dominio, duplicidad o concurrencia
- `500` para errores inesperados

## Lógica de negocio implementada

`DeliveryOrderService` ya resuelve estos casos:

- crear entrega
- consultar entrega por ID
- consultar entrega por `orderId`
- asignar repartidor
- marcar como recogida
- marcar en tránsito
- marcar como entregada
- marcar como fallida
- cancelar entrega
- validar transiciones de estado
- registrar historial
- convertir entidad a DTO de respuesta

Reglas aplicadas:

- creación idempotente por `orderId`
- si el mismo `orderId` llega con los mismos datos, devuelve la entrega existente
- si el mismo `orderId` llega con datos distintos, devuelve conflicto
- manejo de `DataIntegrityViolationException` para creación concurrente
- persistencia del historial desde la primera fase
- transiciones de estado estrictas
- bloqueo de cambios desde estados finales

## API implementada

Controlador: [DeliveryController.java](../../delivery-service/src/main/java/com/fastorder/delivery/controller/DeliveryController.java)

Endpoints disponibles:

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/deliveries` | Crea una entrega |
| GET | `/deliveries/{id}` | Consulta una entrega por ID |
| GET | `/deliveries/by-order/{orderId}` | Consulta una entrega por `orderId` |
| PATCH | `/deliveries/{id}/assign` | Asigna repartidor |
| PATCH | `/deliveries/{id}/pick-up` | Marca recogida |
| PATCH | `/deliveries/{id}/in-transit` | Marca en tránsito |
| PATCH | `/deliveries/{id}/deliver` | Marca como entregada |
| PATCH | `/deliveries/{id}/fail` | Marca como fallida |
| PATCH | `/deliveries/{id}/cancel` | Cancela entrega |
| GET | `/actuator/health` | Estado del servicio |
| GET | `/actuator/prometheus` | Métricas Prometheus |

## Reglas funcionales vigentes

- no se puede crear más de una entrega para el mismo `order_id`
- la creación debe ser idempotente
- si llega el mismo `orderId` con datos diferentes, se considera conflicto
- solo se aceptan estados definidos en `DeliveryStatus`
- no se permiten transiciones inválidas
- `DELIVERED`, `FAILED` y `CANCELLED` son estados finales
- toda transición se registra en historial

## Archivos creados o ajustados

### Archivos principales del servicio

- `delivery-service/src/main/java/com/fastorder/delivery/DeliveryServiceApplication.java`
- `delivery-service/src/main/java/com/fastorder/delivery/controller/DeliveryController.java`
- `delivery-service/src/main/java/com/fastorder/delivery/service/DeliveryOrderService.java`
- `delivery-service/src/main/java/com/fastorder/delivery/repository/DeliveryOrderRepository.java`
- `delivery-service/src/main/java/com/fastorder/delivery/repository/DeliveryStatusHistoryRepository.java`
- `delivery-service/src/main/java/com/fastorder/delivery/model/DeliveryOrder.java`
- `delivery-service/src/main/java/com/fastorder/delivery/model/DeliveryStatusHistory.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/CreateDeliveryRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/AssignDriverRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/FailDeliveryRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/CancelDeliveryRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/response/DeliveryResponse.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/response/DeliveryStatusHistoryResponse.java`
- `delivery-service/src/main/java/com/fastorder/delivery/enums/DeliveryStatus.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/DeliveryNotFoundException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/DeliveryAlreadyExistsException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/InvalidDeliveryStatusException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/DeliveryConflictException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/GlobalExceptionHandler.java`
- `delivery-service/src/main/resources/application.yaml`
- `delivery-service/src/test/java/com/fastorder/delivery/DeliveryServiceApplicationTests.java`

### Base de datos y documentación

- `database/fastorder-init.sql`
- `docs/servicios/delivery-service.md`
