CREATE TABLE IF NOT EXISTS productos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion VARCHAR(500),
    precio NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
    categoria VARCHAR(80) NOT NULL,
    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos (activo);
CREATE INDEX IF NOT EXISTS idx_productos_disponible_activo ON productos (disponible, activo);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_activo ON productos (categoria, activo);

INSERT INTO productos (nombre, descripcion, precio, categoria, disponible, activo)
VALUES
    ('Hamburguesa Clasica', 'Hamburguesa con carne, queso, lechuga, tomate y salsa de la casa', 45.00, 'Hamburguesas', TRUE, TRUE),
    ('Pizza Margarita', 'Pizza personal con salsa de tomate, mozzarella y albahaca', 55.00, 'Pizzas', TRUE, TRUE),
    ('Ensalada Cesar', 'Lechuga romana, pollo, crutones, parmesano y aderezo cesar', 38.00, 'Ensaladas', TRUE, TRUE),
    ('Pasta Alfredo', 'Pasta con salsa alfredo cremosa y pollo a la plancha', 52.00, 'Pastas', TRUE, TRUE),
    ('Limonada Natural', 'Bebida fria de limon natural', 15.00, 'Bebidas', TRUE, TRUE)
ON CONFLICT DO NOTHING;
