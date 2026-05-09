# Prueba de carga con k6

## Escenario ejecutado

Prueba de lectura contra API Gateway para validar 50,000 peticiones sin modificar datos de negocio.

```powershell
docker run --rm --network fastorderha_fastorder-network `
  -v "${PWD}\monitoring\k6:/scripts" `
  -e TOTAL_REQUESTS=50000 `
  -e VUS=100 `
  grafana/k6:0.54.0 run /scripts/read-stress.js
```

## Endpoints usados

- `GET /api/menu/productos`
- `GET /api/menu/productos/disponibles`
- `GET /api/orders`
- `GET /api/inventory/check?productId=1&quantity=1`

## Resultado

- Requests totales: `50,000`
- VUs: `100`
- Checks exitosos: `50,000 / 50,000`
- Errores HTTP: `0`
- Throughput aproximado: `4,858 req/s`
- Duracion promedio: `9.98 ms`
- p95: `36.37 ms`
- Max: `189.1 ms`

## Verificacion posterior

Todos los contenedores quedaron levantados despues de la prueba.

Prometheus reporto los targets monitoreados en estado `up`.

## Nota

Esta prueba valida carga de lectura. Para validar escrituras masivas de ordenes se debe preparar inventario alto o datos de prueba separados, porque el flujo real consume/reserva inventario y puede activar reglas de negocio.
