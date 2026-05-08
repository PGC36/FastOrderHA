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
