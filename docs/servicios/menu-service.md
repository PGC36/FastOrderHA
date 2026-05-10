# menu-service

## Responsabilidad

`menu-service` administra el catalogo de productos del restaurante. Permite consultar productos, filtrar disponibles, buscar por categoria y mantener la informacion basica del menu.

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

## Endpoints

Los endpoints se consumen por medio del API Gateway usando el prefijo `/api/menu/productos`.

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/api/menu/productos` | Lista todos los productos activos |
| `GET` | `/api/menu/productos/disponibles` | Lista productos disponibles |
| `GET` | `/api/menu/productos/{id}` | Consulta producto por ID |
| `GET` | `/api/menu/productos/categoria/{categoria}` | Lista productos por categoria |
| `POST` | `/api/menu/productos` | Crea un producto |
| `PUT` | `/api/menu/productos/{id}` | Actualiza un producto |
| `PATCH` | `/api/menu/productos/{id}/disponibilidad` | Cambia disponibilidad |
| `DELETE` | `/api/menu/productos/{id}` | Desactiva logicamente un producto |

## Ejemplo de producto

```json
{
  "nombre": "Pollo Frito",
  "descripcion": "Orden de pollo frito",
  "categoria": "Comida",
  "disponible": true
}
```

## Papel dentro del flujo critico

El flujo de 50k pedidos usa `productId = 1`, creado por el script inicial de base de datos. `menu-service` no participa como consumer de la Saga principal, pero representa el catalogo usado por pedidos e inventario.

## Observabilidad

Expone:

| Endpoint | Uso |
|---|---|
| `/actuator/health` | Health del servicio |
| `/actuator/prometheus` | Metricas Prometheus |

## Docker

```powershell
docker compose up --build -d menu-service
docker compose logs -f menu-service
```
