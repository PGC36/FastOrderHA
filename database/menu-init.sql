CREATE TABLE IF NOT EXISTS productos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion VARCHAR(500),
    categoria VARCHAR(80) NOT NULL,
    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos (activo);
CREATE INDEX IF NOT EXISTS idx_productos_disponible_activo ON productos (disponible, activo);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_activo ON productos (categoria, activo);

INSERT INTO productos (nombre, descripcion, categoria, disponible, activo)
VALUES
    ('Pollo Frito', 'Pollo frito crujiente', 'Pollos', TRUE, TRUE)
ON CONFLICT DO NOTHING;
