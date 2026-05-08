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
