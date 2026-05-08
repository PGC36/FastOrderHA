# Kitchen Service

## Resumen

`kitchen-service` es el microservicio encargado de gestionar órdenes de cocina dentro de FastOrder HA.

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

- paquete base `com.fastorder.kitchen`
- estructura por capas
- entidad principal `KitchenOrder`
- DTOs de entrada y salida
- repositorio JPA
- lógica de negocio
- controlador REST
- manejo global de excepciones
- configuración `application.yaml`
- script SQL en `database/kitchen-init.sql`
- test base de contexto

## Responsabilidad del servicio

El servicio actualmente permite:

- registrar órdenes enviadas a cocina
- consultar órdenes de cocina
- cambiar el estado de preparación
- evitar duplicados por `order_id`
- exponer health check
- exponer métricas para Prometheus

## Estados implementados

Los estados definidos e implementados son:

- `PENDING`
- `PREPARING`
- `READY`
- `CANCELLED`

## Estructura actual

```text
kitchen-service/
├── pom.xml
├── mvnw
├── mvnw.cmd
├── HELP.md
└── src/
    ├── main/
    │   ├── java/com/fastorder/kitchen/
    │   │   ├── KitchenServiceApplication.java
    │   │   ├── controller/
    │   │   │   └── KitchenOrderController.java
    │   │   ├── dto/
    │   │   │   ├── CreateKitchenOrderRequest.java
    │   │   │   ├── KitchenOrderResponse.java
    │   │   │   └── UpdateKitchenStatusRequest.java
    │   │   ├── enums/
    │   │   │   └── KitchenOrderStatus.java
    │   │   ├── exception/
    │   │   │   ├── GlobalExceptionHandler.java
    │   │   │   └── ResourceNotFoundException.java
    │   │   ├── model/
    │   │   │   └── KitchenOrder.java
    │   │   ├── repository/
    │   │   │   └── KitchenOrderRepository.java
    │   │   └── service/
    │   │       └── KitchenOrderService.java
    │   └── resources/
    │       └── application.yaml
    └── test/
        └── java/com/fastorder/kitchen/
            └── KitchenServiceApplicationTests.java
```

## Dependencias configuradas

En `pom.xml` están configuradas estas dependencias:

- `spring-boot-starter-web`
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-validation`
- `spring-boot-starter-actuator`
- `io.micrometer:micrometer-registry-prometheus`
- `org.postgresql:postgresql`
- `org.projectlombok:lombok`
- `spring-boot-starter-test`

Adicionalmente:

- Java `21`
- empaquetado JAR

## Configuración actual

Archivo: [application.yaml](../../kitchen-service/src/main/resources/application.yaml)

```yaml
server:
  port: 8084

spring:
  application:
    name: kitchen-service
  datasource:
    url: jdbc:postgresql://localhost:5444/kitchen_db
    username: kitchen_user
    password: kitchen123
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    properties:
      hibernate:
        format_sql: true

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

La base del servicio es independiente y usa el script:

- [kitchen-init.sql](../../database/kitchen-init.sql)

Contrato SQL actual:

```sql
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (
        status IN ('PENDING', 'PREPARING', 'READY', 'CANCELLED')
    ),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    ready_at TIMESTAMP
);
```

Decisiones aplicadas:

- `order_id` es único
- no existe `foreign key` hacia otra tabla de otro microservicio
- Hibernate solo valida el esquema con `ddl-auto: validate`

## Modelo implementado

Entidad principal: `KitchenOrder`

Campos implementados:

- `id`
- `orderId`
- `status`
- `createdAt`
- `updatedAt`
- `startedAt`
- `readyAt`

Comportamiento implementado:

- `@PrePersist` asigna `createdAt`, `updatedAt` y `PENDING` por defecto
- `@PreUpdate` actualiza `updatedAt`

## DTOs implementados

Se crearon estos DTOs:

- `CreateKitchenOrderRequest`
- `UpdateKitchenStatusRequest`
- `KitchenOrderResponse`

Validaciones implementadas:

- `orderId` obligatorio en creación
- `status` obligatorio en actualización

## Repositorio implementado

`KitchenOrderRepository` extiende `JpaRepository<KitchenOrder, Long>` e incluye:

- `findByOrderId(Long orderId)`
- `existsByOrderId(Long orderId)`

## Manejo de errores implementado

Se implementó:

- `ResourceNotFoundException`
- `GlobalExceptionHandler`

Mapeo actual:

- errores de validación
- recurso no encontrado
- errores generales no controlados

## Lógica de negocio implementada

`KitchenOrderService` ya resuelve estos casos:

- listar órdenes
- obtener orden por ID
- crear orden de forma idempotente por `orderId`
- actualizar estado
- asignar `startedAt` cuando la orden pasa a `PREPARING`
- asignar `readyAt` cuando la orden pasa a `READY`
- convertir entidad a DTO de respuesta

Detalles importantes:

- si la misma orden llega otra vez, se devuelve la existente
- se agregó manejo de `DataIntegrityViolationException` para soportar mejor creación concurrente básica

## API implementada

Controlador: [KitchenOrderController.java](../../kitchen-service/src/main/java/com/fastorder/kitchen/controller/KitchenOrderController.java)

Endpoints disponibles:

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/kitchen/orders` | Lista órdenes de cocina |
| GET | `/kitchen/orders/{id}` | Obtiene una orden por ID |
| POST | `/kitchen/orders` | Crea una orden de cocina |
| PATCH | `/kitchen/orders/{id}/status` | Actualiza el estado |
| GET | `/actuator/health` | Estado del servicio |
| GET | `/actuator/prometheus` | Métricas Prometheus |

## Reglas funcionales vigentes

- no se puede crear más de una orden de cocina para el mismo `order_id`
- solo se aceptan estados definidos en `KitchenOrderStatus`
- cada actualización de estado refresca `updated_at`
- `started_at` se usa cuando la orden pasa a `PREPARING`
- `ready_at` se usa cuando la orden pasa a `READY`

## Archivos creados o ajustados

### Archivos principales del servicio

- `kitchen-service/src/main/java/com/fastorder/kitchen/KitchenServiceApplication.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/controller/KitchenOrderController.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/service/KitchenOrderService.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/repository/KitchenOrderRepository.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/model/KitchenOrder.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/dto/CreateKitchenOrderRequest.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/dto/UpdateKitchenStatusRequest.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/dto/KitchenOrderResponse.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/enums/KitchenOrderStatus.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/exception/ResourceNotFoundException.java`
- `kitchen-service/src/main/java/com/fastorder/kitchen/exception/GlobalExceptionHandler.java`
- `kitchen-service/src/main/resources/application.yaml`
- `kitchen-service/src/test/java/com/fastorder/kitchen/KitchenServiceApplicationTests.java`

### Base de datos y documentación

- `database/kitchen-init.sql`
- `docs/servicios/kitchen-service.md`
