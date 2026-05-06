# Estructura docs

```plaintext
docs/
├── README.md
├── arquitectura.md
├── servicios/
│   ├── api-gateway.md
│   ├── menu-service.md
│   ├── order-service.md
│   ├── inventory-service.md
│   ├── kitchen-service.md
│   ├── delivery-service.md
│   ├── notification-service.md
├── api/
│   ├── endpoints.md
│   └── auth.md
├── docs-standards.md
├── database.md
└── deployment.md
```

## Contenidos mínimos

### README.md
- Descripción general del sistema
- Objetivo del proyecto
- Tecnologías utilizadas
- Instrucciones básicas de ejecución

### arquitectura.md
- Descripción de la arquitectura (microservicios, capas, etc.)
- Relación entre servicios
- Diagramas (opcional en texto o imagen)
- Decisiones técnicas relevantes

### servicios/*.md
Para cada microservicio incluir:    
- Nombre del servicio
- Responsabilidad principal
- Endpoints expuestos
- Dependencias (otros servicios o bases de datos)
- Flujo básico de funcionamiento

### api/endpoints.md
- Lista de endpoints agrupados por servicio
- Método HTTP (GET, POST, etc.)
- Ruta
- Descripción
- Ejemplo de request y response

### api/auth.md
- Tipo de autenticación (JWT, OAuth, etc.)
- Flujo de autenticación
- Ejemplo de uso

### database.md
- Descripción del esquema
- Tablas principales
- Relaciones
- Estrategia de migraciones

### deployment.md
- Requisitos del sistema
- Variables de entorno
- Uso de Docker o docker-compose
- Pasos para despliegue en producción

## Estándar de escritura para documentar

- Usar títulos jerárquicos:
    - `#` para título principal
    - `##` para secciones
    - `###` para subsecciones
- Usar listas para claridad
- Incluir ejemplos de código cuando aplique
- Mantener lenguaje técnico, claro y conciso
- Evitar redundancia

## Convenciones de formato

### Código en bloques
```bash
docker-compose up --build
```

## Mantenimiento de la documentación

- Actualizar la documentación en cada cambio relevante del sistema
- Mantener coherencia entre código y documentación
- Revisar periódicamente la documentación
- Asignar responsables de documentación por servicio

## Buenas prácticas

- Un archivo por tema
- Nombrar archivos de forma consistente
- Usar enlaces internos entre documentos
- Documentar decisiones importantes, no solo implementación
