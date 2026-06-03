# Autenticacion y autorizacion

## Estado actual

FastOrder HA no implementa autenticacion de usuarios en el alcance actual del proyecto.

Tampoco implementa autorizacion por roles ni proteccion por token en el API Gateway o en los microservicios.

La seguridad de entrada se enfoca en:

- API Gateway como punto unico de acceso.
- Sin dependencia actual de Redis en el gateway.
- Observabilidad de peticiones y errores.

## Justificacion

El objetivo principal del proyecto es demostrar alta disponibilidad, consistencia eventual, mensajeria asincrona, tolerancia a fallos, pruebas de carga, caos y backups. Por eso, la autenticacion queda fuera del flujo critico evaluado.

## Comportamiento actual

Los endpoints locales no requieren token:

```powershell
Invoke-RestMethod http://localhost:8080/api/menu/productos
```

En la version actual no hay un rate limiter activo ni una dependencia operativa de Redis en el gateway.

Los endpoints `/actuator/**` siguen siendo endpoints operativos para salud y monitoreo.

## Lo que si existe

La proteccion actual del sistema se basa en controles operativos, no en identidad de usuario:

- enrutamiento centralizado por `api-gateway`;
- aislamiento de microservicios dentro de Docker Compose;
- credenciales tecnicas para PostgreSQL, RabbitMQ y Grafana solo para entorno local;
- observabilidad con Actuator, Prometheus y Grafana.

## Mejora futura

Para una version productiva se recomienda agregar:

- JWT en el API Gateway.
- Roles para administradores y clientes.
- Proteccion de endpoints administrativos.
- Trazabilidad por usuario.
- Limites de tasa por usuario autenticado y por IP.
- Secretos fuera de archivos de configuracion locales.
