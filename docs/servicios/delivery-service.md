# Delivery Service

## Resumen del enfoque

`delivery-service` se implementará como un microservicio autónomo, con base de datos PostgreSQL independiente, reglas explícitas de transición de estado e idempotencia en la creación de entregas. En esta primera etapa el objetivo es construir una base simple, mantenible y técnicamente correcta para un proyecto universitario, sin incorporar todavía mensajería, Redis, Actuator ni Prometheus.

La meta es dejar el servicio preparado para:

- ejecutarse con múltiples réplicas;
- evitar duplicados por `order_id`;
- proteger consistencia ante concurrencia;
- soportar reintentos seguros;
- mantener trazabilidad del ciclo de vida de cada entrega;
- integrarse más adelante con observabilidad y eventos asíncronos.

## Fase 1. Revisión inicial del proyecto

Objetivo:

- Entender el estado actual de `delivery-service` antes de implementar.

Archivos a revisar:

- `delivery-service/pom.xml`
- `delivery-service/src/main/resources/application.yaml`
- `delivery-service/src/main/java/com/fastorder/delivery_service/DeliveryServiceApplication.java`
- `delivery-service/src/test/java/...`
- `docker-compose.yml`
- `database/delivery-init.sql`
- `docs/servicios/delivery-service.md`
- `docs/arquitectura.md`
- `api-gateway/src/main/resources/application.yaml`

Explicación técnica:

- El nombre del microservicio se mantiene como `delivery-service`.
- El paquete base Java recomendado debe ser `com.fastorder.delivery`.
- El proyecto actual fue generado con Initializr y seguramente habrá que migrar desde `com.fastorder.delivery_service`.
- Hay que validar cómo está definida la base `delivery_db` en `docker-compose.yml` y alinear el servicio a esa infraestructura.

Convenciones a seguir:

- `application.yaml` en lugar de `application.properties`
- paquete base `com.fastorder.delivery`
- DTOs separados de entidades
- excepciones personalizadas
- `LocalDateTime` para timestamps
- `ddl-auto: validate`
- `orderId` como referencia simple
- rutas REST limpias con `/deliveries`

Paquetes que deberían existir:

- `controller`
- `service`
- `repository`
- `model`
- `dto.request`
- `dto.response`
- `enums`
- `exception`
- `config`

Riesgos:

- dejar el paquete generado por Initializr y romper consistencia con el repo;
- modelar relaciones JPA entre microservicios;
- mezclar lógica de negocio con transporte HTTP.

Validación esperada:

- tener una decisión clara de naming, estructura y contrato técnico antes de escribir código.

## Fase 2. Diseño de paquetes recomendado

Objetivo:

- Definir una estructura simple, consistente y mantenible.

Archivos a crear o reorganizar:

- `src/main/java/com/fastorder/delivery/DeliveryServiceApplication.java`
- `controller/*`
- `service/*`
- `repository/*`
- `model/*`
- `dto/request/*`
- `dto/response/*`
- `enums/*`
- `exception/*`
- `config/*`

Explicación técnica:

Estructura recomendada:

```text
com.fastorder.delivery
├── DeliveryServiceApplication.java
├── controller/
├── service/
├── repository/
├── model/
├── dto/
│   ├── request/
│   └── response/
├── enums/
├── exception/
└── config/
```

Sugerencia:

- `config` puede quedar vacío al inicio, pero conviene reservarlo para clientes HTTP, serialización o configuraciones futuras.

Riesgos:

- meter toda la lógica en pocos paquetes;
- acoplar DTOs con entidades JPA.

Validación esperada:

- estructura lista para crecer sin refactors innecesarios.

## Fase 3. Diseño de base de datos

Objetivo:

- Definir una base PostgreSQL independiente, consistente e idempotente.

Archivos a crear o modificar:

- `database/delivery-init.sql`
- documentación del servicio

Explicación técnica:

### Tabla principal: `delivery_orders`

Campos mínimos recomendados:

- `id`
- `order_id`
- `status`
- `assigned_driver_id`
- `delivery_address`
- `created_at`
- `updated_at`
- `assigned_at`
- `picked_up_at`
- `in_transit_at`
- `delivered_at`
- `failed_at`
- `cancelled_at`
- `cancel_reason`
- `failure_reason`
- `version`

Diseño propuesto:

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
```

### Tabla de trazabilidad: `delivery_status_history`

Esta tabla debe incluirse desde la primera fase.

Campos sugeridos:

- `id`
- `delivery_order_id`
- `previous_status`
- `new_status`
- `reason`
- `changed_at`
- `changed_by`

Diseño propuesto:

```sql
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

Justificación:

- `order_id` debe ser `UNIQUE` para impedir entregas duplicadas.
- `delivery_status_history` da trazabilidad desde la primera versión.
- `version` permite concurrencia optimista con JPA.
- Los índices por `status`, `assigned_driver_id` y `created_at` ayudan a consultas operativas y reportes básicos.
- Los índices del historial permiten consultar rápidamente el trazado temporal de una entrega.

Riesgos:

- permitir múltiples filas para el mismo pedido;
- no registrar cambios de estado desde el inicio;
- no dejar evidencia de fallos o cancelaciones.

Validación esperada:

- esquema claro, auditable y preparado para reintentos.

## Fase 4. Estrategia de alta disponibilidad

Objetivo:

- Diseñar el servicio para correr en varias réplicas sin corromper datos.

Archivos a impactar más adelante:

- entidad JPA
- repository
- service
- `application.yaml`
- `Dockerfile`
- `docker-compose.yml`

Explicación técnica:

Principios que deben guiar la implementación:

- operaciones idempotentes por `order_id`;
- restricción `UNIQUE(order_id)`;
- uso de `@Version` para concurrencia optimista;
- operaciones de escritura dentro de transacciones;
- reintentos seguros;
- no usar memoria local para datos críticos;
- validar transiciones antes de persistir;
- traducir conflictos de integridad o concurrencia a `409 CONFLICT`.

Regla específica para creación:

- si llega el mismo `orderId` con los mismos datos, se devuelve la entrega existente;
- si llega el mismo `orderId` con datos distintos, se devuelve `409 CONFLICT`.

Manejo correcto de concurrencia en creación:

- no basta con preguntar primero si la entrega existe;
- con múltiples réplicas puede ocurrir que dos instancias lean “no existe” y ambas intenten insertar;
- la protección real debe apoyarse en `UNIQUE(order_id)` en PostgreSQL;
- la estrategia recomendada es:
  1. intentar crear la entrega;
  2. si ocurre `DataIntegrityViolationException` por duplicidad de `order_id`, buscar la entrega existente;
  3. comparar los datos de entrada contra la entrega ya persistida;
  4. si los datos coinciden, devolver la entrega existente;
  5. si los datos son distintos, devolver `409 CONFLICT`.

Estrategias concretas:

- `createDeliveryForOrder(orderId, deliveryAddress)` debe ser idempotente;
- `assignDriver` no debe sobrescribir asignaciones concurrentes silenciosamente;
- una transición inválida debe fallar con error de dominio;
- ninguna operación crítica debe depender de variables en memoria de una sola instancia.

Riesgos:

- doble creación por peticiones paralelas;
- pérdida de consistencia entre réplicas;
- conflictos silenciosos por actualización concurrente.

Validación esperada:

- diseño apto para múltiples instancias sobre la misma base del servicio.

## Fase 5. Flujo de estados permitido

Objetivo:

- Definir el ciclo de vida de una entrega y bloquear transiciones inválidas.

Explicación técnica:

Estados:

- `PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

Transiciones válidas recomendadas:

- `PENDING -> ASSIGNED`
- `PENDING -> CANCELLED`
- `ASSIGNED -> PICKED_UP`
- `ASSIGNED -> CANCELLED`
- `PICKED_UP -> IN_TRANSIT`
- `PICKED_UP -> FAILED`
- `IN_TRANSIT -> DELIVERED`
- `IN_TRANSIT -> FAILED`

Estados finales:

- `DELIVERED`
- `FAILED`
- `CANCELLED`

Reglas:

- desde estados finales no debe permitirse ningún cambio;
- se elimina la transición `IN_TRANSIT -> CANCELLED`;
- si la entrega ya está en camino y no puede completarse, debe usar `FAILED`.

Cómo impedir transiciones inválidas:

- método centralizado `validateStatusTransition(current, target)`;
- mapa explícito de transiciones permitidas;
- excepción de dominio convertida a `409`.

Riesgos:

- permitir saltos inválidos como `PENDING -> DELIVERED`;
- cancelar una entrega que ya está en tránsito;
- permitir cambios desde estados terminales.

Validación esperada:

- flujo de negocio consistente, fácil de razonar y fácil de probar.

## Fase 6. Endpoints REST recomendados

Objetivo:

- Diseñar una API REST limpia, explícita e idempotente.

Explicación técnica:

Todas las rutas deben usar `/deliveries`.

### 1. Crear entrega a partir de un pedido

- Método: `POST`
- Ruta: `/deliveries`
- Request esperado:
  - `orderId`
  - `deliveryAddress`
- Response esperado:
  - entrega creada o existente
- Validaciones:
  - `orderId` obligatorio y positivo
  - `deliveryAddress` obligatorio y no vacío
- Posibles errores:
  - `400` datos inválidos
  - `409` mismo `orderId` con datos distintos

### 2. Consultar entrega por `order_id`

- Método: `GET`
- Ruta: `/deliveries/by-order/{orderId}`
- Response esperado:
  - detalle de entrega
- Validaciones:
  - `orderId` positivo
- Posibles errores:
  - `404` no encontrado

### 3. Consultar entrega por ID

- Método: `GET`
- Ruta: `/deliveries/{id}`
- Response esperado:
  - detalle de entrega
- Posibles errores:
  - `404` no encontrado

### 4. Asignar repartidor

- Método: `PATCH`
- Ruta: `/deliveries/{id}/assign`
- Request esperado:
  - `driverId`
- Response esperado:
  - entrega actualizada
- Validaciones:
  - `driverId` obligatorio y positivo
  - solo desde `PENDING`
- Posibles errores:
  - `404` no encontrado
  - `409` transición inválida o concurrencia

### 5. Marcar como recogida

- Método: `PATCH`
- Ruta: `/deliveries/{id}/pick-up`
- Response esperado:
  - entrega actualizada
- Validaciones:
  - solo desde `ASSIGNED`
- Posibles errores:
  - `404`
  - `409`

### 6. Marcar en tránsito

- Método: `PATCH`
- Ruta: `/deliveries/{id}/in-transit`
- Validaciones:
  - solo desde `PICKED_UP`
- Posibles errores:
  - `404`
  - `409`

### 7. Marcar como entregada

- Método: `PATCH`
- Ruta: `/deliveries/{id}/deliver`
- Validaciones:
  - solo desde `IN_TRANSIT`
- Posibles errores:
  - `404`
  - `409`

### 8. Marcar como fallida

- Método: `PATCH`
- Ruta: `/deliveries/{id}/fail`
- Request esperado:
  - `reason`
- Validaciones:
  - razón obligatoria
  - solo desde `PICKED_UP` o `IN_TRANSIT`
- Posibles errores:
  - `400`
  - `404`
  - `409`

### 9. Cancelar entrega

- Método: `PATCH`
- Ruta: `/deliveries/{id}/cancel`
- Request esperado:
  - `reason`
- Validaciones:
  - razón obligatoria
  - solo desde `PENDING` o `ASSIGNED`
- Posibles errores:
  - `400`
  - `404`
  - `409`

Riesgos:

- usar rutas demasiado genéricas;
- permitir cambios de estado arbitrarios desde el cliente.

Validación esperada:

- API coherente con el dominio y fácil de probar.

## Fase 7. DTOs necesarios

Objetivo:

- Separar claramente contratos de entrada y salida.

Archivos a crear:

- `dto/request/CreateDeliveryRequest.java`
- `dto/request/AssignDriverRequest.java`
- `dto/request/FailDeliveryRequest.java`
- `dto/request/CancelDeliveryRequest.java`
- `dto/response/DeliveryResponse.java`
- `dto/response/DeliveryStatusHistoryResponse.java`

Explicación técnica:

Validaciones sugeridas:

- `@NotNull`
- `@NotBlank`
- `@Size`
- `@Positive`

Campos esperados:

- `CreateDeliveryRequest`
  - `orderId`
  - `deliveryAddress`
- `AssignDriverRequest`
  - `driverId`
- `FailDeliveryRequest`
  - `reason`
- `CancelDeliveryRequest`
  - `reason`
- `DeliveryResponse`
  - `id`
  - `orderId`
  - `status`
  - `assignedDriverId`
  - `deliveryAddress`
  - timestamps relevantes

Riesgos:

- exponer entidades JPA directamente;
- omitir validaciones de entrada.

Validación esperada:

- contrato REST limpio, validable y seguro.

## Fase 8. Entidades JPA

Objetivo:

- Modelar correctamente el dominio de entrega.

Archivos a crear:

- `model/DeliveryOrder.java`
- `model/DeliveryStatusHistory.java`
- `enums/DeliveryStatus.java`

Explicación técnica:

### Entidad `DeliveryOrder`

Campos sugeridos:

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

Anotaciones recomendadas:

- `@Entity`
- `@Table(name = "delivery_orders", indexes = ...)`
- `@Enumerated(EnumType.STRING)`
- `@Version`
- `@PrePersist`
- `@PreUpdate`

### Entidad `DeliveryStatusHistory`

Debe entrar desde la primera fase para trazabilidad.

Relación recomendada:

- `ManyToOne(fetch = FetchType.LAZY)` hacia `DeliveryOrder`
- `@JoinColumn(name = "delivery_order_id", nullable = false)`
- sin cascadas agresivas ni reglas que comprometan la vida de la entrega principal

Notas:

- no se recomienda relación JPA con entidades de otros microservicios;
- `orderId` y `assignedDriverId` quedan como referencias simples.

Riesgos:

- acoplar el dominio de entrega con otros servicios;
- omitir `@Version` y debilitar la protección de concurrencia.

Validación esperada:

- modelo claro, persistible y preparado para varias réplicas.

## Fase 9. Repositorios

Objetivo:

- Definir acceso a datos mínimo y suficiente.

Archivos a crear:

- `repository/DeliveryOrderRepository.java`
- `repository/DeliveryStatusHistoryRepository.java`

Explicación técnica:

Métodos recomendados:

- `findByOrderId(Long orderId)`
- `existsByOrderId(Long orderId)`
- `findByStatus(DeliveryStatus status)`
- `findByAssignedDriverId(Long driverId)` si luego hace falta

Consultas opcionales:

- `findByIdForUpdate(...)` con bloqueo pesimista solo si más adelante el modelo realmente lo exige

Recomendación:

- empezar con concurrencia optimista usando `@Version`;
- agregar bloqueo pesimista solo si resulta necesario tras pruebas.

Riesgos:

- sobrecomplicar el acceso a datos desde el inicio;
- no cubrir búsquedas críticas por `orderId`.

Validación esperada:

- repositorios suficientes para la primera fase funcional.

## Fase 10. Servicios de negocio

Objetivo:

- Concentrar reglas del dominio en una capa clara.

Archivos a crear:

- `service/DeliveryOrderService.java`

Explicación técnica:

Métodos recomendados:

- `createDelivery`
- `getDeliveryById`
- `getDeliveryByOrderId`
- `assignDriver`
- `markPickedUp`
- `markInTransit`
- `markDelivered`
- `markFailed`
- `cancelDelivery`
- `validateStatusTransition`
- `recordStatusHistory`
- `toResponse`

Reglas a centralizar:

- idempotencia de creación;
- comparación de payload para detectar mismo `orderId` con datos distintos;
- validación de transición de estado;
- actualización de timestamps por estado;
- persistencia de historial;
- traducción de conflictos de concurrencia a error de dominio.

Riesgos:

- duplicar reglas entre controller y service;
- no centralizar la validación de estados.

Validación esperada:

- lógica de negocio testeable, explícita y sin ambigüedades.

## Fase 11. Manejo de errores

Objetivo:

- Exponer errores consistentes y legibles para clientes y pruebas.

Archivos a crear:

- `exception/DeliveryNotFoundException.java`
- `exception/DeliveryAlreadyExistsException.java`
- `exception/InvalidDeliveryStatusException.java`
- `exception/DeliveryConflictException.java`
- `exception/GlobalExceptionHandler.java`

Explicación técnica:

Mapeo requerido:

- `400` para validaciones inválidas del request
- `404` para entrega no encontrada
- `409` para conflicto de estado, duplicidad o concurrencia
- `500` para errores inesperados

Errores sugeridos:

- `DeliveryNotFoundException`
- `DeliveryAlreadyExistsException`
- `InvalidDeliveryStatusException`
- `DeliveryConflictException`

Respuesta JSON sugerida:

- `timestamp`
- `status`
- `error`
- `message`
- opcionalmente `path`

Riesgos:

- filtrar excepciones técnicas al cliente;
- no diferenciar errores funcionales de conflictos.

Validación esperada:

- respuestas claras, consistentes y aptas para pruebas.

## Fase 12. Configuración `application.yaml`

Objetivo:

- Definir una configuración inicial limpia para desarrollo y despliegue.

Archivos a crear o modificar:

- `delivery-service/src/main/resources/application.yaml`

Explicación técnica:

Configuración mínima recomendada:

- `spring.application.name=delivery-service`
- puerto sugerido: `8085`
- datasource local apuntando a `localhost:5445/delivery_db`
- en Docker: `delivery-db:5432/delivery_db`
- `ddl-auto: validate`
- `show-sql: true` solo en desarrollo
- logging básico por paquete si hace falta

Perfiles:

- un solo archivo es suficiente al inicio;
- si luego crece, separar perfiles `dev` y `prod`.

Restricciones explícitas:

- mantener `ddl-auto: validate`;
- no usar Flyway todavía;
- las tablas deben crearse desde `database/delivery-init.sql`.

Riesgos:

- usar `create`, `update` o `create-drop` en Hibernate;
- mezclar configuración local y Docker sin aclaración.

Validación esperada:

- servicio conectable localmente y listo para variables de entorno.

## Fase 13. Preparación para Docker

Objetivo:

- Dejar definido cómo se empacará y ejecutará el servicio.

Archivos a crear más adelante:

- `delivery-service/Dockerfile`
- entrada en `docker-compose.yml`

Explicación técnica:

Necesidades:

- imagen JAR multi-stage;
- variables de entorno para datasource;
- sin dependencia de archivos locales del host;
- puerto interno consistente con gateway.

Variables de entorno sugeridas:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

Riesgos:

- hornear configuración sensible dentro de la imagen;
- usar `localhost` dentro del contenedor.

Validación esperada:

- plan claro para contenedor reproducible.

## Fase 14. Preparación para alta disponibilidad en Docker y Kubernetes

Objetivo:

- Asegurar que el servicio pueda escalar horizontalmente.

Explicación técnica:

Buenas prácticas:

- no usar sesiones locales;
- no guardar estado crítico en memoria;
- no asumir una sola instancia;
- hacer que cualquier réplica pueda atender cualquier request;
- mantener toda consistencia crítica en PostgreSQL;
- diseñar para reintentos seguros.

En Docker Compose:

- evitar `container_name` si luego se quiere escalar;
- usar `expose` en lugar de `ports` si se desea escalar internamente;
- pasar por `api-gateway` en la demo final.

En Kubernetes:

- este diseño se traduce bien a múltiples pods detrás de un Service estable.

Riesgos:

- almacenar información crítica en memoria local;
- diseñar flujos que requieran afinidad de sesión.

Validación esperada:

- servicio conceptualmente listo para varias réplicas.

## Fase 15. Pruebas recomendadas

Objetivo:

- Cubrir reglas de negocio, idempotencia y concurrencia.

Explicación técnica:

Pruebas sugeridas:

- unitarias para transiciones de estado;
- unitarias para validación de reglas de negocio;
- integración con PostgreSQL;
- prueba de concurrencia para impedir doble creación o doble asignación;
- prueba de idempotencia para creación por `orderId`;
- pruebas REST con MockMvc o equivalente.

Casos importantes:

- crear dos veces el mismo `orderId` con los mismos datos;
- crear dos veces el mismo `orderId` con datos distintos y verificar `409`;
- intentar transición inválida;
- asignar repartidor dos veces en paralelo;
- marcar como entregado desde estado incorrecto;
- cancelar después de `DELIVERED`, `FAILED` o `CANCELLED` y verificar que falle.

Riesgos:

- probar solo el happy path;
- no cubrir conflictos de concurrencia.

Validación esperada:

- base robusta para demostrar consistencia.

## Fase 16. Futuras dependencias a agregar

Objetivo:

- Identificar qué tecnologías sumar después y en qué momento.

Explicación técnica:

Agregar más adelante cuando ya exista base funcional:

- `Spring Boot Actuator`
  - cuando se habiliten health checks y observabilidad
- `Prometheus`
  - cuando se integre monitoreo del stack
- `Spring Data Redis`
  - si luego se necesita cache o locks distribuidos
- `RabbitMQ` o `Kafka`
  - cuando se integren eventos asíncronos y consistencia eventual
- `Flyway`
  - cuando se quiera versionar migraciones formalmente
- `Testcontainers`
  - cuando se fortalezcan pruebas de integración reales
- `Spring Security`
  - cuando se agregue autenticación o autorización real

Nota:

- Ninguna de estas dependencias debe agregarse todavía en esta primera fase.

Riesgos:

- agregar piezas de infraestructura antes de estabilizar el dominio principal.

Validación esperada:

- backlog técnico ordenado y gradual.

## Fase 17. Primera fase de implementación recomendada

Objetivo:

- Preparar una implementación inicial ordenada sin romper el proyecto.

Orden recomendado:

1. Revisar `pom.xml`, `application.yaml`, `docker-compose.yml` y `database/delivery-init.sql`.
2. Mantener el nombre del microservicio como `delivery-service`.
3. Normalizar el paquete base a `com.fastorder.delivery`.
4. Crear estructura de paquetes.
5. Diseñar y escribir `database/delivery-init.sql`.
6. Crear enum `DeliveryStatus`.
7. Crear entidad `DeliveryOrder` con `@Version`.
8. Crear entidad `DeliveryStatusHistory`.
9. Crear DTOs de request y response.
10. Crear repositories.
11. Crear excepciones personalizadas.
12. Implementar `DeliveryOrderService`.
13. Implementar `DeliveryOrderController` con rutas `/deliveries`.
14. Configurar `application.yaml` con `ddl-auto: validate`.
15. Probar creación idempotente.
16. Probar transiciones válidas e inválidas.
17. Probar conflictos por concurrencia.
18. Documentar decisiones finales del dominio.
19. Luego avanzar con Docker y despliegue.
20. Después incorporar observabilidad y mensajería.

Riesgos:

- arrancar por Docker o mensajería antes de cerrar el modelo de negocio;
- definir endpoints sin cerrar antes el flujo de estados.

Validación esperada:

- implementación incremental, ordenada y fácil de defender.

## Conclusión

La recomendación para `delivery-service` es construir primero un núcleo transaccional pequeño y sólido: entidad principal de entrega, historial de estados desde la primera fase, `order_id` único, creación idempotente, control optimista de concurrencia y reglas estrictas de transición. Con eso quedará bien posicionado para alta disponibilidad básica y para sumar más adelante Docker operativo, healthchecks, observabilidad y eventos asíncronos sin rehacer el diseño.

## Implementación actual

Hasta este punto ya quedó implementada la base inicial del microservicio:

- paquete base `com.fastorder.delivery`;
- configuración `application.yaml` con `ddl-auto: validate`;
- script SQL en `database/delivery-init.sql`;
- entidad `DeliveryOrder`;
- entidad `DeliveryStatusHistory`;
- enum `DeliveryStatus`;
- DTOs de request y response;
- repositorios JPA;
- excepciones de dominio y `GlobalExceptionHandler`;
- `DeliveryOrderService` con creación idempotente y transiciones de estado;
- `DeliveryController` con rutas REST bajo `/deliveries`.

Endpoints implementados:

- `POST /deliveries`
- `GET /deliveries/{id}`
- `GET /deliveries/by-order/{orderId}`
- `PATCH /deliveries/{id}/assign`
- `PATCH /deliveries/{id}/pick-up`
- `PATCH /deliveries/{id}/in-transit`
- `PATCH /deliveries/{id}/deliver`
- `PATCH /deliveries/{id}/fail`
- `PATCH /deliveries/{id}/cancel`

## Cambios realizados

### 1. Estructura y paquete base

Se realizaron estos cambios estructurales:

- migración del paquete generado por Initializr desde `com.fastorder.delivery_service` hacia `com.fastorder.delivery`;
- creación de paquetes `controller`, `service`, `repository`, `model`, `dto.request`, `dto.response`, `enums` y `exception`;
- reemplazo de la clase principal para alinearla con el nuevo paquete base;
- actualización del test base de contexto al nuevo paquete.

### 2. Dependencias y configuración Maven

Se ajustó `pom.xml` para dejar una base coherente con la primera fase:

- se mantuvo Spring Boot con Maven y empaquetado JAR;
- se conservó JPA, Validation, PostgreSQL Driver y Lombok;
- se usó `spring-boot-starter-web` como dependencia REST;
- se dejó `spring-boot-starter-test` para pruebas;
- no se agregaron nuevas dependencias;
- no se agregaron Redis, RabbitMQ, Kafka, Actuator, Prometheus, Flyway ni Security.

### 3. Configuración del servicio

Se dejó configurado `application.yaml` con:

- `spring.application.name=delivery-service`;
- puerto `8085`;
- datasource local apuntando a `localhost:5445/delivery_db`;
- `ddl-auto: validate`;
- `show-sql: true`;
- `hibernate.format_sql: true`.

Decisión aplicada:

- Hibernate solo valida el esquema y no crea tablas automáticamente.

### 4. Base de datos

Se implementó el script `database/delivery-init.sql` con:

- tabla `delivery_orders`;
- tabla `delivery_status_history`;
- restricción `UNIQUE(order_id)`;
- índices por `status`, `assigned_driver_id` y `created_at`;
- índices por `delivery_order_id` y `changed_at` en historial;
- `version` para concurrencia optimista;
- `foreign key` entre historial y entrega.

### 5. Dominio implementado

Se creó el enum `DeliveryStatus` con:

- `PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

Se implementaron estas entidades:

- `DeliveryOrder`
- `DeliveryStatusHistory`

Reglas aplicadas en el modelo:

- uso de `LocalDateTime` para fechas;
- uso de `@Version` para concurrencia optimista;
- uso de `@PrePersist` y `@PreUpdate`;
- relación `ManyToOne(fetch = FetchType.LAZY)` desde historial hacia entrega;
- sin relaciones JPA con otros microservicios.

### 6. DTOs implementados

Se crearon:

- `CreateDeliveryRequest`
- `AssignDriverRequest`
- `FailDeliveryRequest`
- `CancelDeliveryRequest`
- `DeliveryResponse`
- `DeliveryStatusHistoryResponse`

Validaciones aplicadas:

- `@NotNull`
- `@NotBlank`
- `@Positive`
- `@Size`

### 7. Repositorios implementados

Se implementaron:

- `DeliveryOrderRepository`
- `DeliveryStatusHistoryRepository`

Métodos principales disponibles:

- `findByOrderId`
- `existsByOrderId`
- `findByStatus`
- `findByAssignedDriverId`
- `findByDeliveryOrderIdOrderByChangedAtAsc`

### 8. Manejo de errores implementado

Se crearon las excepciones:

- `DeliveryNotFoundException`
- `DeliveryAlreadyExistsException`
- `InvalidDeliveryStatusException`
- `DeliveryConflictException`

También se implementó `GlobalExceptionHandler` con este mapeo:

- `400` para errores de validación;
- `404` para entrega no encontrada;
- `409` para conflictos de dominio, duplicidad o concurrencia;
- `500` para errores inesperados.

### 9. Lógica de negocio implementada

Se implementó `DeliveryOrderService` con estos métodos principales:

- `createDelivery`
- `getDeliveryById`
- `getDeliveryByOrderId`
- `assignDriver`
- `markPickedUp`
- `markInTransit`
- `markDelivered`
- `markFailed`
- `cancelDelivery`
- `validateStatusTransition`
- `recordStatusHistory`
- `toResponse`

Reglas ya aplicadas:

- creación idempotente por `orderId`;
- comparación de payload para detectar mismo `orderId` con datos distintos;
- manejo de `DataIntegrityViolationException` para creación concurrente;
- persistencia de historial desde la primera fase;
- transiciones de estado estrictas;
- bloqueo de cambios desde estados finales.

### 10. API REST implementada

Se implementó `DeliveryController` con rutas limpias bajo `/deliveries`.

Operaciones disponibles:

- crear entrega;
- consultar por ID;
- consultar por `orderId`;
- asignar repartidor;
- marcar recogida;
- marcar en tránsito;
- marcar entregada;
- marcar fallida;
- cancelar entrega.

## Archivos creados o modificados

### Archivos creados

- `delivery-service/src/main/java/com/fastorder/delivery/DeliveryServiceApplication.java`
- `delivery-service/src/main/java/com/fastorder/delivery/enums/DeliveryStatus.java`
- `delivery-service/src/main/java/com/fastorder/delivery/model/DeliveryOrder.java`
- `delivery-service/src/main/java/com/fastorder/delivery/model/DeliveryStatusHistory.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/CreateDeliveryRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/AssignDriverRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/FailDeliveryRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/request/CancelDeliveryRequest.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/response/DeliveryResponse.java`
- `delivery-service/src/main/java/com/fastorder/delivery/dto/response/DeliveryStatusHistoryResponse.java`
- `delivery-service/src/main/java/com/fastorder/delivery/repository/DeliveryOrderRepository.java`
- `delivery-service/src/main/java/com/fastorder/delivery/repository/DeliveryStatusHistoryRepository.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/DeliveryNotFoundException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/DeliveryAlreadyExistsException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/InvalidDeliveryStatusException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/DeliveryConflictException.java`
- `delivery-service/src/main/java/com/fastorder/delivery/exception/GlobalExceptionHandler.java`
- `delivery-service/src/main/java/com/fastorder/delivery/service/DeliveryOrderService.java`
- `delivery-service/src/main/java/com/fastorder/delivery/controller/DeliveryController.java`
- `delivery-service/src/test/java/com/fastorder/delivery/DeliveryServiceApplicationTests.java`

### Archivos modificados

- `delivery-service/pom.xml`
- `delivery-service/src/main/resources/application.yaml`
- `database/delivery-init.sql`
- `docs/servicios/delivery-service.md`

### Archivos reemplazados o eliminados

- clase principal vieja bajo `com.fastorder.delivery_service`;
- test viejo bajo `com.fastorder.delivery_service`.

## Decisiones técnicas ya tomadas

Quedaron fijadas estas decisiones:

- el microservicio se llama `delivery-service`;
- el paquete base es `com.fastorder.delivery`;
- la base de datos es independiente;
- las rutas REST usan `/deliveries`;
- `order_id` se usa como referencia simple y única;
- la creación es idempotente;
- el historial entra desde la primera fase;
- se usa concurrencia optimista con `@Version`;
- las transiciones inválidas devuelven conflicto;
- no se usan todavía dependencias de observabilidad ni mensajería.

## Estado de validación

Se intentó ejecutar compilación y pruebas con Maven.

Resultado:

- la validación automática no pudo completarse en este entorno porque el sandbox no tiene acceso de red a Maven Central para descargar `spring-boot-starter-parent:4.0.6`.

Conclusión práctica:

- el bloqueo actual fue de entorno, no una excepción confirmada del código del proyecto;
- la siguiente validación real debe ejecutarse en una máquina o entorno con acceso normal a dependencias Maven.

## Pendiente

Todavía no se ha implementado:

- integración de `delivery-service` al `docker-compose.yml`;
- integración de rutas en `api-gateway`;
- `Dockerfile`;
- healthcheck de contenedor;
- pruebas automáticas completas;
- observabilidad;
- mensajería asíncrona.
