# 📦 Inventory Service (Microservicio de Inventario)

##  1. Contexto del Problema y Dominio
Dentro de la arquitectura de **FastOrder HA**, el **Inventory Service** es el microservicio central encargado de proteger el activo físico más importante del restaurante: **el stock de ingredientes y productos**. 

Su objetivo no es solo guardar números en una tabla, sino actuar como un "guardián" concurrente que evite anomalías de datos bajo escenarios de alto estrés (ej. la hora pico del restaurante). Si este servicio falla o es inconsistente, la cocina recibe órdenes que no puede preparar y el cliente paga por productos inexistentes, rompiendo la promesa de la aplicación.

##  2. Estado Actual y Especificaciones Técnicas
* **Tecnología Base:** Java 21 / Spring Boot 3.5.14
* **Puerto de Aplicación:** `8082`
* **Persistencia:** PostgreSQL general `fastorder_db` (puerto local `5440`)
  * **Aislamiento logico:** aunque la base fisica es compartida, este servicio sigue siendo el duenio funcional de la tabla `inventory`. Otros microservicios deben comunicarse por los endpoints expuestos o mediante eventos.
* **Componentes Listos:** 
  * Entidad (`Inventory.java`)
  * Repositorio JPA (`InventoryRepository.java`)
  * Capa de Negocio Transaccional (`InventoryService.java`)
  * API RESTful (`InventoryController.java`)
  * Script de migracion inicial consolidado (`fastorder-init.sql`)
  * Integracion RabbitMQ con `inventory.events.queue`

##  3. Reglas Críticas de Negocio Aseguradas
De acuerdo a las reglas críticas del sistema, este microservicio defiende las siguientes directrices bajo cualquier condición de concurrencia:

1. **No sobrevivir ventas (Sobrevender):** Un pedido jamás podrá confirmarse si no hay stock real suficiente.
2. **No descontar inventario doble:** El sistema distingue entre stock total y stock "reservado". Cuando entra una orden, se suma al campo `reserved`, garantizando que ese stock exacto se respete hasta que la orden se complete o sea cancelada (compensación).
3. **Consistencia Transaccional Estricta:** Gracias a la anotación `@Transactional` de Spring, el método `reserveStock()` asegura que la lectura del stock y la actualización del descuento ocurran como una única unidad atómica. Si dos hilos intentan reservar la última hamburguesa al milisegundo exacto, la base de datos aplicará un lock a nivel de fila y rechazará la transacción que no cumpla con la cantidad mínima, devolviendo un error controlado y previniendo el saldo negativo.

##  4. Modelo de Datos
La tabla principal, inicializada a través del Docker Compose, se diseñó enfocándose en la simplicidad y el rendimiento:
* `id` (BIGSERIAL): Llave primaria.
* `product_id` (BIGINT UNIQUE): Identificador único del producto referenciado (asociado al Menu Service). Su índice único previene duplicidades de catálogo.
* `quantity` (INTEGER): Cantidad física total disponible en el almacén.
* `reserved` (INTEGER): Cantidad que actualmente está en carritos de compra o pedidos no despachados.
* *El stock real vendible siempre se calcula en memoria como:* `(quantity - reserved)`.

##  5. Endpoints REST Implementados (Prueba Funcional)

### A. Endpoint de Consulta de Disponibilidad (Lectura)
Permite a otros servicios (como el API Gateway o el Order Service) verificar rápidamente si es posible armar un pedido antes de intentar reservarlo.
* **Método:** `GET`
* **Ruta:** `/api/inventory/check?productId={id}&quantity={cantidad}`
* **Respuestas:** Devuelve un booleano (`true` o `false`).

### B. Endpoint de Reserva de Stock (Escritura Crítica)
Ejecuta la transacción de retención del inventario.
* **Método:** `POST`
* **Ruta:** `/api/inventory/reserve`
* **Payload (JSON):**
  ```json
  {
      "productId": 1,
      "quantity": 5
  }
