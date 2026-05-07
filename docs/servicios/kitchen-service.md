# Kitchen Service

## Objetivo

El microservicio `kitchen-service` será responsable de gestionar las órdenes enviadas a cocina dentro de FastOrder HA.

En esta primera etapa nos enfocaremos en una base funcional y estable, trabajando la base de datos de forma aislada para no mezclar todavía integraciones entre microservicios.
Esta etapa debe entenderse como una base preparada para alta disponibilidad básica dentro del proyecto, no como una implementación completa de alta disponibilidad.

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
- Preparación para alta disponibilidad básica con réplicas, health checks y reinicio automático.

No incluye todavía:

- RabbitMQ.
- Consumo o publicación de eventos.
- Orquestación avanzada entre microservicios.
- Acoplamiento directo con entidades de otros servicios.
- Alta disponibilidad completa a nivel de mensajería, descubrimiento de servicios u orquestadores como Kubernetes.

## Estados de cocina

Los estados definidos para una orden de cocina serán:

- `PENDING`
- `PREPARING`
- `READY`
- `CANCELLED`

## Principios de diseño

- La base de datos se trabajará de forma aislada en esta fase.
- `kitchen-service` manejará `orderId` como referencia simple, sin relación JPA directa con `order-service`.
- En esta primera etapa puede mantenerse una `foreign key` hacia `orders(id)` porque el proyecto usa una base compartida para simplificar la demostración.
- En una versión más desacoplada, `kitchen-service` debería conservar `orderId` como referencia externa sin `foreign key` directa.
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
- Conexión a PostgreSQL levantado desde el `docker-compose.yml` principal del proyecto
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

Nota:

- Usar `localhost` en el datasource solo cuando `kitchen-service` se ejecute fuera de Docker.
- Cuando `kitchen-service` se ejecute dentro de Docker Compose, debe usarse el nombre del servicio `postgres`, por ejemplo `jdbc:postgresql://postgres:5432/fastorder`.

## Gestión de base de datos en esta etapa

En esta fase, la base de datos no será administrada por `kitchen-service` de forma independiente.

Se trabajará así:

- PostgreSQL se levantará desde el `docker-compose.yml` principal del proyecto.
- La estructura inicial de la base se cargará usando [init.sql](../../database/init.sql).
- `kitchen-service` consumirá esa base compartida como cliente.
- El servicio validará el esquema existente con `ddl-auto: validate`.
- Hibernate no debe crear ni alterar tablas automáticamente.

Implicación práctica:

- La infraestructura base del entorno se centraliza en el `docker-compose` raíz.
- El microservicio solo debe conectarse a esa base y trabajar sobre el esquema ya definido.

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
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    ready_at TIMESTAMP
);
```

Nota:

- En esta fase se mantiene la referencia hacia `orders(id)` porque el proyecto usa una base de datos compartida.
- Si después queremos acercarnos más a una arquitectura de microservicios estricta, la variante sería `order_id INT NOT NULL UNIQUE` sin `foreign key` directa.
- No hace falta crear un índice adicional sobre `order_id` porque la restricción `UNIQUE` ya genera uno automáticamente en PostgreSQL.

## Contrato funcional inicial

### Reglas

- No se puede crear más de una orden de cocina para el mismo `order_id`.
- Solo se aceptan estados definidos en el enum.
- Cada actualización de estado debe refrescar `updated_at`.
- `started_at` puede registrarse cuando la orden pase a `PREPARING`.
- `ready_at` puede registrarse cuando la orden pase a `READY`.
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

## Enfoque de alta disponibilidad en esta etapa

En esta fase, `kitchen-service` no implementará todavía alta disponibilidad completa. El objetivo es dejar una base técnicamente defendible para demostrar resiliencia básica dentro del stack local.

Esto significa:

- El servicio debe poder ejecutarse con múltiples réplicas.
- Debe contar con `healthcheck` para detectar instancias no saludables.
- Debe reiniciarse automáticamente ante fallos simples del contenedor.
- La demostración final debe acceder al servicio a través de `api-gateway`.
- RabbitMQ queda diferido para una etapa posterior, cuando se trabaje resiliencia basada en eventos.

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
- Apuntar el datasource a la base levantada desde el `docker-compose` principal.
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
- Mantener `foreign key` a `orders(id)` en esta etapa compartida.
- Validar restricción de estados permitidos.
- Agregar `started_at` y `ready_at` como apoyo para trazabilidad y evidencias.

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
- Incluir `orderId`, `status`, `createdAt`, `updatedAt`, `startedAt` y `readyAt`.
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
- Evitar `container_name` fijo para permitir escalado.
- Dejar la configuración lista para usar `restart: always` y `healthcheck`.

Resultado esperado:

- Servicio integrable al stack local.

### Fase 16. Preparar alta disponibilidad básica

Objetivo:

- Permitir que `kitchen-service` pueda ejecutarse con múltiples réplicas y recuperarse ante fallos básicos.

Actividades:

- Evitar usar `container_name` fijo en `docker-compose` para `kitchen-service`.
- Configurar `restart: always`.
- Agregar `healthcheck` usando `/actuator/health`.
- Validar que `kitchen-service` puede levantarse con más de una réplica.
- Acceder a `kitchen-service` mediante `api-gateway` y no directamente por puerto fijo en la demo final.
- Probar la caída manual de un contenedor del `kitchen-service`.
- Confirmar que el servicio sigue operando si una réplica falla.

Resultado esperado:

- `kitchen-service` puede reiniciarse automáticamente.
- `kitchen-service` puede ejecutarse con varias réplicas.
- La caída de una réplica no detiene completamente la operación.
- La prueba genera evidencia útil para logs, Prometheus y documentación.

### Fase 17. Conectar Prometheus

Objetivo:

- Habilitar scraping de métricas del servicio.

Actividades:

- Agregar `kitchen-service` a `monitoring/prometheus.yml`.

Resultado esperado:

- Métricas observables desde Prometheus.

### Fase 18. Documentación final del microservicio

Objetivo:

- Dejar documentado el servicio para implementación y revisión.

Actividades:

- Mantener actualizado este documento.
- Ajustar endpoints, reglas y notas técnicas según avance real.

Resultado esperado:

- Documentación alineada con la implementación.

### Fase 19. Integración futura con RabbitMQ

Objetivo:

- Preparar la siguiente etapa sin mezclarla con esta base inicial.

Actividades futuras:

- Definir eventos de entrada y salida.
- Agregar dependencias de mensajería.
- Diseñar consumidores y publicadores.
- Revisar estrategia de idempotencia con eventos.
- Definir cómo evitar pérdida de eventos ante caída de consumidores o reinicios de servicios.

Resultado esperado:

- Backlog claro para la siguiente iteración.

Nota:

- RabbitMQ será necesario en una etapa posterior para mejorar resiliencia entre servicios, reducir acoplamiento temporal y evitar pérdida de eventos cuando falle un consumidor o una instancia no esté disponible temporalmente.

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
17. Preparar alta disponibilidad básica.
18. Agregar Prometheus.
19. Mantener actualizada esta documentación.
20. Después agregar RabbitMQ.

## Nota técnica para `docker-compose`

Para que `kitchen-service` quede alineado con alta disponibilidad básica dentro del entorno local, debemos seguir estas reglas:

- No usar `container_name` en `kitchen-service` si se desea escalar con Docker Compose.
- No mapear `ports` directos en `kitchen-service` si se desea escalar con múltiples réplicas.
- Usar `expose` para publicar el puerto solo dentro de la red interna de Docker.
- Usar `restart: always`.
- Agregar `healthcheck` apuntando a `http://localhost:3004/actuator/health`.
- Verificar que la imagen final del contenedor incluya la herramienta usada por el `healthcheck`, por ejemplo `curl` o `wget`.
- Usar variables de entorno para la conexión a PostgreSQL.
- En la demo final, el acceso al flujo funcional debe pasar por `api-gateway`.

Ejemplo de configuración:

```yaml
kitchen-service:
  build: ./kitchen-service
  expose:
    - "3004"
  environment:
    SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/fastorder
    SPRING_DATASOURCE_USERNAME: postgres
    SPRING_DATASOURCE_PASSWORD: postgres
  depends_on:
    postgres:
      condition: service_healthy
  restart: always
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3004/actuator/health"]
    interval: 10s
    timeout: 5s
    retries: 5
```

Importante:

- Este servicio no debe incluir `container_name` si se quiere ejecutar con múltiples réplicas.
- Este servicio no debe publicar `ports` fijos si se quiere usar `--scale`.
- El acceso externo debe pasar por `api-gateway`.

## Nota técnica para Dockerfile

Si el `healthcheck` usa `curl` o `wget`, la imagen final del contenedor debe incluir esa herramienta.

Recomendación práctica:

- Si se usa `curl` en `docker-compose`, instalar `curl` en la imagen final del servicio.
- Si se usa `wget`, verificar que la imagen base lo incluya.
- No asumir que una imagen JRE mínima ya trae utilidades de red disponibles.

Ejemplo conceptual:

```dockerfile
FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY target/*.jar app.jar

EXPOSE 3004

ENTRYPOINT ["java", "-jar", "app.jar"]
```

## Prueba básica de resiliencia

Para demostrar disponibilidad básica en la etapa inicial, la prueba sugerida será:

1. Levantar el stack.
2. Crear varias órdenes de cocina.
3. Escalar `kitchen-service` a 3 réplicas.
4. Enviar peticiones continuas mediante `api-gateway`.
5. Matar una réplica de `kitchen-service`.
6. Confirmar que las peticiones siguen respondiendo.
7. Confirmar que no se duplican órdenes por `order_id`, incluyendo reintentos repetidos con el mismo `orderId`.
8. Revisar logs y métricas en Prometheus.

Comandos de ejemplo:

```bash
docker compose up --scale kitchen-service=3
docker ps
docker kill <contenedor_kitchen_service>
```

Evidencias esperadas:

- El gateway sigue respondiendo solicitudes funcionales hacia cocina.
- Al menos una réplica de `kitchen-service` continúa procesando solicitudes.
- No aparecen órdenes duplicadas para el mismo `orderId`.
- Los logs muestran reinicio o continuidad operativa.
- Prometheus refleja el comportamiento del servicio durante la prueba.

Ejemplo de validación de idempotencia:

```bash
curl -X POST http://localhost:<PUERTO_GATEWAY>/kitchen/orders \
  -H "Content-Type: application/json" \
  -d '{"orderId":1}'
```

Este mismo request puede repetirse varias veces durante la prueba y el resultado esperado es que no se creen órdenes duplicadas para el mismo `orderId`.

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
- Puede ejecutarse con múltiples réplicas.
- Tiene `healthcheck` configurado.
- Tiene reinicio automático básico.
- Puede demostrar caída y recuperación de una réplica.
- Mantiene la regla de no duplicar órdenes por `orderId` incluso durante pruebas de resiliencia.

## Nota de implementación

La meta de esta etapa no es cerrar todo el ecosistema de cocina, sino construir una base sólida, demostrable y preparada para alta disponibilidad básica. Primero hacemos que el servicio funcione bien por REST, PostgreSQL, Docker y métricas; después añadimos mensajería, eventos e integraciones más complejas.
