# Menu Service

## Proposito

`menu-service` es el microservicio de FastOrder HA encargado de consultar y administrar los productos del menu del restaurante. Expone endpoints REST consumidos por `api-gateway` y trabaja de forma independiente sobre la base de datos `menu_db`.

## Tabla Utilizada

El servicio usa la tabla `productos`, definida en `database/menu-init.sql`.

Columnas esperadas:

- `id`: identificador primario.
- `nombre`: nombre visible del producto.
- `descripcion`: detalle breve del producto.
- `precio`: precio en `NUMERIC(10,2)`, mapeado a `BigDecimal`.
- `categoria`: categoria del producto.
- `disponible`: indica si puede venderse en este momento.
- `activo`: permite desactivar productos sin borrarlos fisicamente.
- `created_at`: fecha de creacion.
- `updated_at`: fecha de ultima actualizacion.

Hibernate esta configurado con `ddl-auto: validate`, por lo que valida la tabla existente y no crea ni elimina estructuras.

## Puerto

El servicio escucha en el puerto `8081`.

```yaml
server:
  port: 8081
```

## Conexion a PostgreSQL

La conexion usa variables de entorno para facilitar despliegues en Docker, Kubernetes o ejecuciones locales.

| Variable | Valor por defecto | Descripcion |
| --- | --- | --- |
| `DB_HOST` | `localhost` | Host de PostgreSQL. |
| `DB_PORT` | `5441` | Puerto publicado para desarrollo local. En Docker interno normalmente es `5432`. |
| `DB_NAME` | `menu_db` | Base de datos del servicio. |
| `DB_USER` | `menu_user` | Usuario de base de datos. |
| `DB_PASSWORD` | `menu123` | Contrasena de base de datos. |

URL configurada:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5441}/${DB_NAME:menu_db}
```

## Endpoints

Base path: `/api/menu/productos`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/menu/productos` | Devuelve todos los productos activos. |
| `GET` | `/api/menu/productos/disponibles` | Devuelve productos activos y disponibles. |
| `GET` | `/api/menu/productos/{id}` | Devuelve el detalle de un producto activo por id. |
| `GET` | `/api/menu/productos/categoria/{categoria}` | Devuelve productos activos filtrados por categoria. |
| `POST` | `/api/menu/productos` | Crea un producto nuevo. |
| `PUT` | `/api/menu/productos/{id}` | Actualiza un producto existente. |
| `PATCH` | `/api/menu/productos/{id}/disponibilidad` | Cambia el campo `disponible`. |
| `DELETE` | `/api/menu/productos/{id}` | Desactiva el producto, marcando `activo=false` y `disponible=false`. |

Ejemplo para cambiar disponibilidad:

```json
{
  "disponible": false
}
```

## Consumo desde API Gateway

`api-gateway` enruta las solicitudes con `Path=/api/menu/**` hacia:

```yaml
uri: http://menu-service:8081
```

Por eso las rutas del controlador mantienen el prefijo `/api/menu/productos`.

En `docker-compose.yml`, el contenedor `menu-service` se registra en la misma red que `api-gateway` y `menu-db`. Dentro de Docker usa `DB_HOST=menu-db` y `DB_PORT=5432`; para desarrollo local usa por defecto `localhost:5441`.

## Health Check y Metricas

Actuator queda disponible para monitoreo:

- `GET /actuator/health`
- `GET /actuator/info`
- `GET /actuator/metrics`
- `GET /actuator/prometheus`

Para verificar disponibilidad:

```bash
curl http://localhost:8081/actuator/health
```

El endpoint `/actuator/health` sirve para Docker, API Gateway o herramientas de monitoreo.

## Decisiones de Resiliencia

- Base de datos independiente para `menu-service`, evitando acoplamiento directo con otros microservicios.
- Endpoints de lectura para catalogo del menu, utiles para que `order-service` o el gateway consulten productos sin depender de operaciones de escritura.
- Eliminacion logica mediante `activo=false`, preservando historial de productos y reduciendo fallos por referencias externas.
- Health checks y metricas basicas con Spring Boot Actuator.
- `ddl-auto: validate` para evitar que Hibernate modifique la base de datos accidentalmente.
- Manejo global de excepciones con respuestas JSON consistentes.

## Logs Importantes

El servicio usa SLF4J con `LoggerFactory`.

- `INFO`: consultas, creacion, actualizacion, cambios de disponibilidad y desactivaciones.
- `WARN`: productos no encontrados, solicitudes invalidas o datos incompletos.
- `ERROR`: fallos internos inesperados.

Estos logs ayudan a observar el comportamiento del servicio en escenarios de alta disponibilidad.

## Errores Controlados

Los errores devuelven un JSON estructurado:

```json
{
  "timestamp": "2026-05-07T10:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Producto con id 5 no encontrado",
  "path": "/api/menu/productos/5"
}
```

Significado:

- `404 Not Found`: el producto solicitado no existe o esta inactivo.
- `400 Bad Request`: el cliente envio datos invalidos, incompletos o con formato incorrecto.
- `500 Internal Server Error`: ocurrio un error inesperado en el servidor.
