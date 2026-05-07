# Kitchen Service

## Objetivo

El microservicio `kitchen-service` será responsable de gestionar las órdenes enviadas a cocina dentro de FastOrder HA.

En esta primera etapa nos enfocaremos en una base funcional y estable, trabajando la base de datos de forma aislada para no mezclar todavía integraciones entre microservicios.

## Responsabilidades del microservicio

- Registrar órdenes enviadas a cocina.
- Consultar órdenes de cocina.
- Cambiar el estado de preparación.
- Evitar duplicados por `order_id`.
- Exponer health checks.
- Exponer métricas para Prometheus.
- Quedar preparado para integrar RabbitMQ más adelante.

## Alcance de esta etapa

Incluye:

- Spring Boot base.
- API REST.
- Persistencia con PostgreSQL.
- Validaciones.
- Actuator.
- Métricas Prometheus.
- Dockerización inicial.
- Integración básica con `docker-compose`.

No incluye todavía:

- RabbitMQ.
- Consumo o publicación de eventos.
- Orquestación avanzada entre microservicios.
- Acoplamiento directo con entidades de otros servicios.

## Estados de cocina

Los estados definidos para una orden de cocina serán:

- `PENDING`
- `PREPARING`
- `READY`
- `CANCELLED`

## Principios de diseño

- La base de datos se trabajará de forma aislada en esta fase.
- `kitchen-service` manejará `orderId` como referencia simple, sin relación JPA directa con `order-service`.
- Hibernate no debe crear ni modificar tablas automáticamente.
- La creación de órdenes debe ser idempotente por `order_id`.
- La implementación se hará por capas para mantener claridad y facilidad de prueba.

## Estructura objetivo del proyecto

```text
FASTORDERHA/
├── kitchen-service/
│   ├── src/
│   ├── pom.xml
│   ├── mvnw
│   ├── mvnw.cmd
│   └── HELP.md
```

## Estructura objetivo de paquetes

Dentro de `kitchen-service/src/main/java/com/fastorder/kitchen/`:

```text
com.fastorder.kitchen
├── KitchenServiceApplication.java
├── controller/
│   └── KitchenOrderController.java
├── service/
│   └── KitchenOrderService.java
├── repository/
│   └── KitchenOrderRepository.java
├── model/
│   └── KitchenOrder.java
├── dto/
│   ├── CreateKitchenOrderRequest.java
│   ├── UpdateKitchenStatusRequest.java
│   └── KitchenOrderResponse.java
├── enums/
│   └── KitchenOrderStatus.java
└── exception/
    ├── GlobalExceptionHandler.java
    └── ResourceNotFoundException.java
```

## Dependencias requeridas

Por ahora, el proyecto Spring Boot de `kitchen-service` parte con estas dependencias base:

- `Spring Web`
- `Spring Data JPA`
- `PostgreSQL Driver`
- `Validation`
- `Spring Boot Actuator`
- `Prometheus`
- `Lombok`

Traducido a `pom.xml`, esto normalmente corresponde a:

- `spring-boot-starter-web`
- `spring-boot-starter-data-jpa`
- `org.postgresql:postgresql`
- `spring-boot-starter-validation`
- `spring-boot-starter-actuator`
- `io.micrometer:micrometer-registry-prometheus`
- `org.projectlombok:lombok`

Para pruebas, también debemos considerar:

- `spring-boot-starter-test`

RabbitMQ queda fuera de esta primera implementación.

## Configuración base esperada

Archivo: `src/main/resources/application.yml`

Lineamientos:

- Puerto del servicio: `3004`
- Nombre de aplicación: `kitchen-service`
- Conexión a PostgreSQL local o aislada
- `ddl-auto: validate`
- Exposición de `health`, `info`, `prometheus` y `metrics`

Ejemplo base:

```yaml
server:
  port: 3004

spring:
  application:
    name: kitchen-service

  datasource:
    url: jdbc:postgresql://localhost:5432/fastorder
    username: postgres
    password: postgres

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

## Base de datos

La tabla `kitchen_orders` debe responder a este contrato:

```sql
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL UNIQUE REFERENCES orders(id),
    status VARCHAR(50) NOT NULL CHECK (
        status IN ('PENDING', 'PREPARING', 'READY', 'CANCELLED')
    ),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_orders_order_id
ON kitchen_orders(order_id);
```

## Contrato funcional inicial

### Reglas

- No se puede crear más de una orden de cocina para el mismo `order_id`.
- Solo se aceptan estados definidos en el enum.
- Cada actualización de estado debe refrescar `updated_at`.
- Si una orden ya existe para un `orderId`, la creación debe devolver la existente.

### Endpoints esperados

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/actuator/health` | Estado del servicio |
| GET | `/actuator/prometheus` | Métricas Prometheus |
| GET | `/kitchen/orders` | Lista órdenes de cocina |
| GET | `/kitchen/orders/{id}` | Obtiene una orden por ID |
| POST | `/kitchen/orders` | Crea una orden de cocina |
| PATCH | `/kitchen/orders/{id}/status` | Actualiza el estado |

## Plan de trabajo por fases

### Fase 1. Crear y verificar el proyecto base Spring Boot

Objetivo:

- Confirmar que `kitchen-service` arranca correctamente.

Actividades:

- Validar que la estructura del proyecto esté completa.
- Entrar a `kitchen-service`.
- Ejecutar `mvn spring-boot:run`.
- Confirmar que el servicio levanta sin errores.

Resultado esperado:

- El proyecto arranca localmente.

### Fase 2. Verificar dependencias

Objetivo:

- Asegurar que el `pom.xml` contiene todo lo necesario para la primera etapa.

Actividades:

- Revisar dependencias REST, JPA, PostgreSQL, Validation, Actuator, Prometheus, Lombok y Test.
- Confirmar que RabbitMQ no se incluye todavía.

Resultado esperado:

- `pom.xml` listo para construir la base del servicio.

### Fase 3. Definir estructura de paquetes

Objetivo:

- Crear una organización clara para controller, service, repository, model, dto, enums y exception.

Actividades:

- Crear la estructura de paquetes acordada.
- Definir la clase principal `KitchenServiceApplication`.

Resultado esperado:

- Estructura base lista para implementar.

### Fase 4. Configurar `application.yml`

Objetivo:

- Dejar configuración local alineada con una base de datos aislada.

Actividades:

- Definir `server.port=3004`.
- Configurar datasource.
- Configurar JPA con `ddl-auto: validate`.
- Exponer endpoints de Actuator y Prometheus.

Resultado esperado:

- Configuración estable y predecible.

### Fase 5. Ajustar la tabla `kitchen_orders`

Objetivo:

- Alinear la tabla con las reglas funcionales del servicio.

Actividades:

- Ajustar definición de `kitchen_orders` en `database/init.sql`.
- Garantizar `order_id` único.
- Validar restricción de estados permitidos.

Resultado esperado:

- Base de datos compatible con la entidad del servicio.

### Fase 6. Crear enum de estados

Objetivo:

- Centralizar los estados válidos de cocina.

Actividades:

- Crear `KitchenOrderStatus`.

Resultado esperado:

- Estados definidos y reutilizables.

### Fase 7. Crear entidad `KitchenOrder`

Objetivo:

- Mapear la tabla `kitchen_orders` en JPA.

Actividades:

- Crear la entidad.
- Incluir `orderId`, `status`, `createdAt`, `updatedAt`.
- Agregar `@PrePersist` y `@PreUpdate`.

Resultado esperado:

- Entidad persistible y consistente.

### Fase 8. Crear DTOs

Objetivo:

- Separar el contrato de entrada y salida de la entidad.

Actividades:

- Crear `CreateKitchenOrderRequest`.
- Crear `UpdateKitchenStatusRequest`.
- Crear `KitchenOrderResponse`.

Resultado esperado:

- API desacoplada del modelo interno.

### Fase 9. Crear repository

Objetivo:

- Exponer operaciones de acceso a datos necesarias para la fase inicial.

Actividades:

- Crear `KitchenOrderRepository`.
- Incluir `findByOrderId` y `existsByOrderId`.

Resultado esperado:

- Capa de persistencia lista para uso en servicio.

### Fase 10. Crear manejo de excepciones

Objetivo:

- Estandarizar respuestas de error.

Actividades:

- Crear `ResourceNotFoundException`.
- Crear `GlobalExceptionHandler`.
- Manejar validaciones y errores inesperados.

Resultado esperado:

- Errores controlados y respuestas uniformes.

### Fase 11. Crear lógica de negocio

Objetivo:

- Implementar comportamiento principal del microservicio.

Actividades:

- Listar órdenes.
- Obtener orden por ID.
- Crear orden idempotente por `orderId`.
- Actualizar estado.
- Convertir entidad a DTO de respuesta.

Resultado esperado:

- Servicio funcional con reglas básicas de negocio.

### Fase 12. Crear controlador REST

Objetivo:

- Exponer el contrato HTTP del servicio.

Actividades:

- Implementar endpoints GET, POST y PATCH.
- Validar payloads con `@Valid`.

Resultado esperado:

- API REST utilizable localmente.

### Fase 13. Probar localmente

Objetivo:

- Validar que el servicio funciona de punta a punta.

Actividades:

- Levantar PostgreSQL.
- Ejecutar `mvn spring-boot:run`.
- Probar creación, consulta y actualización de órdenes.
- Probar health y métricas.

Resultado esperado:

- Flujo funcional validado localmente.

### Fase 14. Crear Dockerfile

Objetivo:

- Dejar el servicio listo para contenedor.

Actividades:

- Crear `Dockerfile` multi-stage.
- Empaquetar la aplicación como jar.
- Exponer puerto `3004`.

Resultado esperado:

- Imagen construible del servicio.

### Fase 15. Integrar con `docker-compose`

Objetivo:

- Permitir levantar `kitchen-service` junto al entorno base.

Actividades:

- Agregar servicio `kitchen-service`.
- Configurar variables de entorno para datasource.
- Agregar `depends_on` hacia `postgres`.

Resultado esperado:

- Servicio integrable al stack local.

### Fase 16. Conectar Prometheus

Objetivo:

- Habilitar scraping de métricas del servicio.

Actividades:

- Agregar `kitchen-service` a `monitoring/prometheus.yml`.

Resultado esperado:

- Métricas observables desde Prometheus.

### Fase 17. Documentación final del microservicio

Objetivo:

- Dejar documentado el servicio para implementación y revisión.

Actividades:

- Mantener actualizado este documento.
- Ajustar endpoints, reglas y notas técnicas según avance real.

Resultado esperado:

- Documentación alineada con la implementación.

### Fase 18. Integración futura con RabbitMQ

Objetivo:

- Preparar la siguiente etapa sin mezclarla con esta base inicial.

Actividades futuras:

- Definir eventos de entrada y salida.
- Agregar dependencias de mensajería.
- Diseñar consumidores y publicadores.
- Revisar estrategia de idempotencia con eventos.

Resultado esperado:

- Backlog claro para la siguiente iteración.

## Orden recomendado de ejecución

Trabajaremos exactamente en este orden:

1. Verificar que el proyecto Spring Boot arranca.
2. Revisar dependencias del `pom.xml`.
3. Configurar `application.yml`.
4. Ajustar tabla `kitchen_orders` en `init.sql`.
5. Crear enum `KitchenOrderStatus`.
6. Crear entidad `KitchenOrder`.
7. Crear DTOs.
8. Crear repository.
9. Crear excepciones.
10. Crear service.
11. Crear controller.
12. Probar endpoints con curl o Postman.
13. Probar `/actuator/health`.
14. Probar `/actuator/prometheus`.
15. Crear `Dockerfile`.
16. Agregar `kitchen-service` al `docker-compose.yml`.
17. Mantener actualizada esta documentación.
18. Después agregar RabbitMQ.

## Resultado esperado de esta primera etapa

Al cerrar esta fase debemos poder demostrar que:

- `kitchen-service` levanta correctamente.
- Se conecta a PostgreSQL.
- Crea órdenes de cocina.
- No duplica órdenes por `orderId`.
- Permite cambiar estado.
- Expone health check.
- Expone métricas para Prometheus.
- Está listo para dockerizarse.

## Nota de implementación

La meta de esta etapa no es cerrar todo el ecosistema de cocina, sino construir una base sólida y demostrable. Primero hacemos que el servicio funcione bien por REST y PostgreSQL; después añadimos mensajería, eventos e integraciones más complejas.
