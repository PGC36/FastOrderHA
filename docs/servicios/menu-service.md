# menu-service

## Responsabilidad

`menu-service` administra el catalogo de productos del restaurante. Expone endpoints REST para consultar productos activos, filtrar productos disponibles, buscar por categoria y mantener la informacion basica del menu.

No participa como consumer de la Saga principal de pedidos. Su papel es mantener el catalogo que usan el API Gateway, los pedidos y el inventario por medio del `productId`.

## Puerto

```text
8081
```

## Base de datos

Usa PostgreSQL general:

```text
fastorder_db
```

Tabla principal:

- `productos`

Columnas principales:

- `id`
- `nombre`
- `descripcion`
- `categoria`
- `disponible`
- `activo`
- `created_at`
- `updated_at`

Indices definidos en el script inicial:

- `idx_productos_activo`
- `idx_productos_disponible_activo`
- `idx_productos_categoria_activo`

Hibernate esta configurado con `ddl-auto: validate`, por lo que valida la estructura existente y no crea ni modifica tablas automaticamente.

## RabbitMQ

El servicio tiene Spring AMQP configurado y declara recursos de mensajeria, pero actualmente no publica ni consume eventos dentro de la Saga principal.

Recursos declarados:

| Recurso | Valor |
|---|---|
| Exchange | `menu.exchange` |
| Cola | `menu.events.queue` |
| Routing key | `menu.event` |

Configuracion relevante:

```text
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=guest
SPRING_RABBITMQ_PASSWORD=guest
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_ATTEMPTS=12
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_INITIAL_INTERVAL=2000
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MULTIPLIER=1.5
SPRING_RABBITMQ_LISTENER_SIMPLE_RETRY_MAX_INTERVAL=15000
```

## Comportamiento

1. Recibe solicitudes HTTP en `/api/menu/productos`.
2. Consulta solo productos activos para las lecturas principales.
3. Permite filtrar productos disponibles y activos.
4. Permite filtrar por categoria ignorando mayusculas y minusculas.
5. Crea productos nuevos con `disponible=true` y `activo=true` cuando esos campos no se envian.
6. Actualiza productos existentes solo si estan activos.
7. Cambia disponibilidad mediante `PATCH`.
8. Desactiva productos con eliminacion logica.

El producto inicial `Pollo Frito` se crea desde `database/fastorder-init.sql`. En el flujo de pruebas de alto volumen, `productId = 1` corresponde a este producto.

## Reglas de producto

Comportamiento relevante al manejar productos:

- `nombre` es obligatorio y acepta hasta 120 caracteres.
- `categoria` es obligatoria y acepta hasta 80 caracteres.
- `descripcion` es opcional y acepta hasta 500 caracteres.
- al crear un producto, `disponible` queda en `true` si no se envia valor.
- al crear un producto, `activo` queda en `true` si no se envia valor.
- las consultas publicas no devuelven productos inactivos.
- `DELETE /api/menu/productos/{id}` no borra fisicamente; marca `activo=false` y `disponible=false`.
- `PATCH /api/menu/productos/{id}/disponibilidad` requiere el campo `disponible` con valor `true` o `false`.

Si un producto no existe o esta inactivo, el servicio responde `404 Not Found`. Si la solicitud tiene datos invalidos, responde `400 Bad Request`.

## Endpoints

Los endpoints se consumen por medio del API Gateway usando el prefijo `/api/menu/productos`. El gateway enruta `/api/menu/**` hacia `menu-service:8081` sin remover el prefijo.

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/api/menu/productos` | Lista productos activos |
| `GET` | `/api/menu/productos/disponibles` | Lista productos activos y disponibles |
| `GET` | `/api/menu/productos/{id}` | Consulta producto activo por ID |
| `GET` | `/api/menu/productos/categoria/{categoria}` | Lista productos activos por categoria |
| `POST` | `/api/menu/productos` | Crea un producto |
| `PUT` | `/api/menu/productos/{id}` | Actualiza un producto activo |
| `PATCH` | `/api/menu/productos/{id}/disponibilidad` | Cambia disponibilidad |
| `DELETE` | `/api/menu/productos/{id}` | Desactiva logicamente un producto |
| `GET` | `/actuator/health` | Health Actuator |
| `GET` | `/actuator/info` | Informacion del servicio |
| `GET` | `/actuator/metrics` | Metricas Actuator |
| `GET` | `/actuator/prometheus` | Metricas Prometheus |

Notas de uso:

- `POST /api/menu/productos` devuelve `201` y la ruta del producto creado.
- `PUT /api/menu/productos/{id}` reemplaza los datos editables del producto activo.
- `PATCH /api/menu/productos/{id}/disponibilidad` espera un cuerpo con `disponible`.
- `DELETE /api/menu/productos/{id}` devuelve `204` cuando desactiva el producto.

## Ejemplos

Crear o actualizar producto:

```json
{
  "nombre": "Pollo Frito",
  "descripcion": "Pollo frito crujiente",
  "categoria": "Pollos",
  "disponible": true,
  "activo": true
}
```

Cambiar disponibilidad:

```json
{
  "disponible": false
}
```

Respuesta de error controlado:

```json
{
  "timestamp": "2026-05-07T10:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Producto con id 5 no encontrado",
  "path": "/api/menu/productos/5"
}
```

## Observabilidad

Expone Actuator/Micrometer para health checks y metricas. Prometheus consulta el servicio en el puerto `8081`.

Registra logs cuando:

- recibe solicitudes HTTP del controlador.
- consulta productos activos.
- consulta productos disponibles.
- consulta productos por categoria.
- crea productos.
- actualiza productos.
- cambia disponibilidad.
- desactiva productos.
- detecta productos inexistentes o inactivos.
- detecta solicitudes invalidas.
- ocurre un error interno inesperado.

## Docker

```bash
docker compose up --build -d menu-service
docker compose logs -f menu-service
```
