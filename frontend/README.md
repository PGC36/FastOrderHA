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
