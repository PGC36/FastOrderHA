# Autenticacion y autorizacion

## Estado actual

FastOrder HA no implementa autenticacion de usuarios en el alcance actual del proyecto.

La seguridad de entrada se enfoca en:

- API Gateway como punto unico de acceso.
- Rate limiting con Redis.
- Degradacion `fail-open` si Redis se reinicia.
- Observabilidad de peticiones y errores.

## Justificacion

El objetivo principal del proyecto es demostrar alta disponibilidad, consistencia eventual, mensajeria asincrona, tolerancia a fallos, pruebas de carga, caos y backups. Por eso, la autenticacion queda fuera del flujo critico evaluado.

## Comportamiento actual

Los endpoints locales no requieren token:

```powershell
Invoke-RestMethod http://localhost:8080/api/menu/productos
```

El gateway si puede responder `429 Too Many Requests` si se baja la capacidad del rate limiter para una prueba especifica.

## Mejora futura

Para una version productiva se recomienda agregar:

- JWT en el API Gateway.
- Roles para administradores y clientes.
- Proteccion de endpoints administrativos.
- Trazabilidad por usuario.
- Limites de tasa por usuario autenticado y por IP.
