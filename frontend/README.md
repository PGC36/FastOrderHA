# FastOrder — Frontend

Interfaz web de FastOrder HA. Consume el API Gateway en `http://localhost:8080`.

## Stack

| Tecnología | Uso |
|---|---|
| React 18 + TypeScript + Vite | Base del proyecto |
| Tailwind CSS 3 | Estilos con CSS variables y dark mode |
| React Router v6 | Navegación |
| TanStack Query | Estado del servidor, polling |
| Zustand | Estado del carrito y UI global |
| Axios | Cliente HTTP con interceptors y retry |
| React Hook Form + Zod | Formularios y validación |
| Framer Motion | Animaciones de estado |
| Recharts | Gráficas en panel admin |
| shadcn/ui (primitivos) | Componentes base (personalizado, no template) |

## Arrancar

```bash
cd frontend

# 1. Copiar variables de entorno
cp .env.example .env

# 2. Instalar dependencias (solo primera vez)
npm install

# 3. Levantar servidor de desarrollo
npm run dev
```

El frontend queda disponible en http://localhost:5173.

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080` | URL del API Gateway |
| `VITE_GRAFANA_URL` | `http://localhost:3000` | Grafana (panel admin) |
| `VITE_RABBITMQ_UI_URL` | `http://localhost:15672` | RabbitMQ Management |
| `VITE_PROMETHEUS_URL` | `http://localhost:9090` | Prometheus |
| `VITE_USE_MOCKS` | `true` | Activar datos mock sin backend |

Con `VITE_USE_MOCKS=true` el frontend funciona sin ningún servicio backend levantado.

## Dos modos de datos (`VITE_USE_MOCKS`)

El frontend tiene un único interruptor que cualquiera puede elegir en su `.env`,
sin necesidad de ramas separadas:

### Modo demostración — `VITE_USE_MOCKS=true`

Todo usa datos de muestra. No requiere backend. Ideal para revisar la UI, hacer
demos sin levantar Docker, o desarrollar el frontend de forma aislada. Las
pantallas operativas (cocina, entrega) muestran tarjetas completas y el botón
"Simular pedido" funciona.

### Modo real — `VITE_USE_MOCKS=false`

El frontend consume el API Gateway (`docker compose up -d` en la raíz del repo).

| Vista | Comportamiento con backend real |
|---|---|
| Menú | Productos reales de la base de datos |
| Checkout | Crea pedidos reales (`POST /api/orders`) |
| Seguimiento | Estado real, polling, timeline |
| Mis Pedidos | Historial real (`GET /api/orders`) |
| Cocina | Datos reales del `kitchen-service` |
| Entrega | Degrada a lista vacía (ver nota) |
| Admin | Métricas simuladas + enlaces a Grafana/Prometheus reales |

**Notas de alcance del backend** (no son bugs del frontend, son límites del
backend actual del proyecto):

- **Precio:** el backend no tiene microservicio de compras/pagos, así que no
  expone `precio`. El frontend asigna un precio imaginario estable derivado del
  nombre del producto.
- **Cocina:** el endpoint real no devuelve nombre ni cantidad del producto, solo
  los tiempos del ciclo de preparación. Las tarjetas se adaptan a lo disponible.
- **Entrega:** el backend no expone un endpoint para *listar* todas las entregas
  (solo por id o por pedido), por lo que el dashboard se muestra vacío en modo
  real en vez de romperse. Requeriría un endpoint nuevo del backend.
- **Admin:** las métricas en vivo son simuladas; las reales viven en
  Prometheus/Grafana, enlazados desde el panel.

### Cómo funciona por dentro (para el equipo)

Es un *feature flag*: un mismo código que se comporta distinto según una variable
de entorno, sin ramas separadas.

1. `VITE_USE_MOCKS` vive en el `.env`.
2. `src/lib/env.ts` la lee una vez y la expone como `USE_MOCKS`.
3. Cada archivo de `src/api/` decide qué devolver según ese valor:

```ts
export async function getProducts() {
  if (USE_MOCKS) return mockProducts          // datos de prueba
  const { data } = await apiClient.get(...)    // datos reales del backend
  return data
}
```

Las pantallas no saben de dónde vienen los datos: solo llaman a `getProducts()`.
La decisión "prueba o real" vive únicamente en la capa `src/api/`.

## Mapa de rutas

| Ruta | Vista | Rol |
|---|---|---|
| `/` | Landing / Home | Todos |
| `/menu` | Menú de productos | Cliente |
| `/checkout` | Checkout | Cliente |
| `/orders/:id` | Seguimiento de pedido | Cliente |
| `/my-orders` | Mis pedidos | Cliente |
| `/kitchen` | Dashboard de cocina (Kanban) | Cocina |
| `/delivery` | Dashboard de entrega | Entrega |
| `/admin` | Observabilidad / métricas | Administrador |
| `/admin/services` | Salud de servicios | Administrador |

## Decisiones de diseño

**Paleta:** Rojo profundo + crema cálido. Sin gradientes morados ni azules genéricos de SaaS. El fondo crema (`#FBF8F3`) evoca papel y comida; el rojo (`#DC2626`) comunica urgencia e identidad de marca.

**Dark mode:** Fondo casi negro tostado (`#0F0B0A`), no azul marino. El rojo se mantiene y agrega un leve glow en modo oscuro.

**Tipografía:** Bricolage Grotesque para display (editorial, con carácter), Inter para cuerpo (legibilidad), JetBrains Mono para datos técnicos (IDs, timestamps).

**Idempotencia:** `idempotencyKey` va en el body del `POST /api/orders`, no como header. Confirmado en `docs/api/endpoints.md`.

## Build de producción

```bash
npm run build
npm run preview
```

Los archivos compilados quedan en `frontend/dist/`.
