# Kitchen Service

## Objetivo

El microservicio `kitchen-service` gestiona las órdenes enviadas a cocina dentro del proyecto FastOrder HA.

En esta etapa se dejó implementada una base funcional por REST + PostgreSQL + validaciones + métricas, preparada para continuar luego con Docker, alta disponibilidad básica y, en una fase posterior, mensajería con RabbitMQ.

## Estado actual

Actualmente ya quedaron implementadas las fases 1 a 13 del plan:

- Proyecto Spring Boot con Maven.
- Paquete base `com.fastorder.kitchen`.
- Estructura por capas.
- Entidad, DTOs, repository, service y controller.
- Manejo global de excepciones.
- Configuración JPA con `ddl-auto: validate`.
- Actuator y Prometheus habilitados.
- Script SQL propio del servicio en `database/kitchen-init.sql`.

## Responsabilidades del microservicio

- Registrar órdenes enviadas a cocina.
- Consultar órdenes de cocina.
- Cambiar el estado de preparación.
- Evitar duplicados por `order_id`.
- Exponer health checks.
- Exponer métricas para Prometheus.
- Quedar preparado para integrar RabbitMQ más adelante.

## Alcance implementado en esta etapa

Incluye:

- Spring Boot base.
- API REST.
- Persistencia con PostgreSQL.
- Validaciones.
- Spring Boot Actuator.
- Métricas Prometheus.
- Configuración local para trabajar contra la base del servicio.

No incluye todavía:

- RabbitMQ.
- Consumo o publicación de eventos.
- Dockerfile.
- Integración de `kitchen-service` al `docker-compose.yml`.
- Healthcheck de contenedor.
- Réplicas y pruebas de resiliencia.
- Orquestación avanzada.

## Estados de cocina

Los estados definidos e implementados son:

- `PENDING`
- `PREPARING`
- `READY`
- `CANCELLED`

## Principios de diseño aplicados

- `kitchen-service` usa `orderId` como referencia simple.
- No existe relación JPA directa con una entidad `Order`.
- Hibernate no crea ni modifica tablas automáticamente.
- La creación de órdenes es idempotente por `order_id`.
- La lógica se separa por capas para mantener claridad y facilidad de prueba.
- La base actual del servicio es independiente y usa su propio script SQL.

## Estructura implementada

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

En `pom.xml` quedaron configuradas estas dependencias:

- `spring-boot-starter-web`
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-validation`
- `spring-boot-starter-actuator`
- `io.micrometer:micrometer-registry-prometheus`
- `org.postgresql:postgresql`
- `org.projectlombok:lombok`
- `spring-boot-starter-test`

Nota:

- El proyecto quedó con Java `21`.
- RabbitMQ todavía no forma parte del `pom.xml`.

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

Notas:

- El puerto quedó en `8084` para alinearse con el `api-gateway` actual.
- `localhost:5444` aplica para ejecución local fuera de Docker, usando la base `kitchen-db` del `docker-compose.yml` raíz.
- Cuando el servicio se ejecute dentro de Docker Compose, el datasource deberá cambiar a `jdbc:postgresql://kitchen-db:5432/kitchen_db`.

## Gestión de base de datos en esta etapa

La base de datos del servicio se administra actualmente desde el `docker-compose.yml` principal del proyecto, pero no como base compartida con `order-service`.

Se trabaja así:

- PostgreSQL de cocina se levanta como `kitchen-db`.
- La estructura inicial se carga usando [kitchen-init.sql](../../database/kitchen-init.sql).
- `kitchen-service` consume esa base como cliente.
- El servicio valida el esquema existente con `ddl-auto: validate`.
- Hibernate no crea ni altera tablas automáticamente.

Implicación práctica:

- En la implementación real actual, `kitchen-service` usa una base separada.
- Por esa razón `order_id` se maneja como referencia simple y no como `foreign key`.

## Contrato SQL implementado

Archivo: [kitchen-init.sql](../../database/kitchen-init.sql)

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

## Modelo implementado

La entidad `KitchenOrder` incluye:

- `id`
- `orderId`
- `status`
- `createdAt`
- `updatedAt`
- `startedAt`
- `readyAt`

Comportamiento implementado:

- `@PrePersist` asigna `createdAt`, `updatedAt` y `PENDING` por defecto si no viene estado.
- `@PreUpdate` actualiza `updatedAt`.

## DTOs implementados

Se crearon estos DTOs:

- `CreateKitchenOrderRequest`
- `UpdateKitchenStatusRequest`
- `KitchenOrderResponse`

Validaciones implementadas:

- `orderId` es obligatorio en creación.
- `status` es obligatorio en actualización.

## Repository implementado

`KitchenOrderRepository` extiende `JpaRepository<KitchenOrder, Long>` e incluye:

- `findByOrderId(Long orderId)`
- `existsByOrderId(Long orderId)`

## Manejo de errores implementado

Se implementó:

- `ResourceNotFoundException`
- `GlobalExceptionHandler`

El manejador global cubre:

- recurso no encontrado;
- errores de validación;
- errores generales no controlados.

## Lógica de negocio implementada

`KitchenOrderService` ya resuelve estos casos:

- listar órdenes;
- obtener orden por ID;
- crear orden de forma idempotente por `orderId`;
- actualizar estado;
- asignar `startedAt` cuando la orden pasa a `PREPARING`;
- asignar `readyAt` cuando la orden pasa a `READY`;
- convertir entidad a DTO de respuesta.

Detalles importantes:

- Si se intenta crear la misma orden más de una vez, se devuelve la existente.
- También se agregó una protección ante `DataIntegrityViolationException` para soportar mejor concurrencia básica en la creación idempotente.

## API implementada

Controlador: [KitchenOrderController.java](../../kitchen-service/src/main/java/com/fastorder/kitchen/controller/KitchenOrderController.java)

Endpoints implementados:

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/kitchen/orders` | Lista órdenes de cocina |
| GET | `/kitchen/orders/{id}` | Obtiene una orden por ID |
| POST | `/kitchen/orders` | Crea una orden de cocina |
| PATCH | `/kitchen/orders/{id}/status` | Actualiza el estado |
| GET | `/actuator/health` | Estado del servicio |
| GET | `/actuator/prometheus` | Métricas Prometheus |

## Reglas funcionales vigentes

- No se puede crear más de una orden de cocina para el mismo `order_id`.
- Solo se aceptan estados definidos en `KitchenOrderStatus`.
- Cada actualización de estado refresca `updated_at`.
- `started_at` puede registrarse al pasar a `PREPARING`.
- `ready_at` puede registrarse al pasar a `READY`.

## Validación y pruebas realizadas

Se dejó implementado:

- test base de contexto con `SpringBootTest`;
- estructura lista para probar endpoints localmente;
- configuración de Actuator y Prometheus activa.

Limitación actual:

- La validación completa con Maven no se pudo ejecutar en este entorno por restricciones del sandbox para descargar dependencias desde Maven Central.

## Fases completadas

Quedaron completadas:

1. Verificar o crear estructura de paquetes.
2. Crear `KitchenOrderStatus`.
3. Crear entidad `KitchenOrder`.
4. Configurar `@PrePersist`.
5. Configurar `@PreUpdate`.
6. Crear DTOs.
7. Crear `KitchenOrderRepository`.
8. Crear `ResourceNotFoundException`.
9. Crear `GlobalExceptionHandler`.
10. Crear `KitchenOrderService`.
11. Crear `KitchenOrderController`.
12. Validar payloads con `@Valid`.
13. Mantener Actuator y Prometheus configurados.

## Pendiente para siguientes fases

Todavía falta implementar:

- `Dockerfile` del servicio.
- Integración de `kitchen-service` al `docker-compose.yml`.
- Variables de entorno de datasource para entorno Docker.
- Healthcheck de contenedor.
- Preparación de alta disponibilidad básica con réplicas.
- Integración con Prometheus a nivel de stack.
- RabbitMQ en una fase posterior.

## Nota de implementación

La base del microservicio ya quedó lista para continuar. El siguiente paso natural es avanzar con Docker, compose, healthcheck, conexión mediante `api-gateway` y luego preparar la fase de resiliencia básica antes de incorporar mensajería.
