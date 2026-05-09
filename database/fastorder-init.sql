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

CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventory (product_id, quantity, reserved)
VALUES (1, 100, 0)
ON CONFLICT (product_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(150) UNIQUE NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL,
    delivery_address VARCHAR(500),
    delivery_retry_count INT NOT NULL DEFAULT 0,
    delivery_last_retry_at TIMESTAMP,
    delivery_failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(500),
    ADD COLUMN IF NOT EXISTS delivery_retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_last_retry_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS delivery_failure_reason VARCHAR(255);

CREATE TABLE IF NOT EXISTS outbox_events (
    id SERIAL PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox_events(processed);

CREATE TABLE IF NOT EXISTS kitchen_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (
        status IN ('PENDING', 'PREPARING', 'READY', 'CANCELLED')
    ),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    ready_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (
        status IN (
            'PENDING',
            'ASSIGNED',
            'PICKED_UP',
            'IN_TRANSIT',
            'DELIVERED',
            'FAILED',
            'CANCELLED'
        )
    ),
    assigned_driver_id BIGINT,
    delivery_address VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    in_transit_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancel_reason VARCHAR(255),
    failure_reason VARCHAR(255),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_status
ON delivery_orders(status);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_assigned_driver_id
ON delivery_orders(assigned_driver_id);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at
ON delivery_orders(created_at);

CREATE TABLE IF NOT EXISTS delivery_status_history (
    id BIGSERIAL PRIMARY KEY,
    delivery_order_id BIGINT NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason VARCHAR(255),
    changed_by VARCHAR(100),
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_delivery_status_history_order
        FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_order_id
ON delivery_status_history(delivery_order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_changed_at
ON delivery_status_history(changed_at);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    channel VARCHAR(30) NOT NULL,
    recipient VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_order_id
    ON notifications (order_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications (created_at);
