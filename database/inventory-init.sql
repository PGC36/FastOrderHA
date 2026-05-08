-- Crear la tabla de inventario
CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar algunos datos de prueba para la demostración del Checkpoint
INSERT INTO inventory (product_id, quantity, reserved) VALUES 
(1, 100, 0), -- Hamburguesa Clásica (ejemplo)
(2, 50, 0),  -- Papas Fritas (ejemplo)
(3, 200, 0); -- Refresco (ejemplo)
