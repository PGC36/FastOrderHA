package com.fastorder.orderservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 150)
    private String idempotencyKey;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, length = 50)
    private String status;

    @Column(name = "delivery_address", length = 500)
    private String deliveryAddress;

    @Column(name = "delivery_retry_count", nullable = false)
    private Integer deliveryRetryCount;

    @Column(name = "delivery_last_retry_at")
    private LocalDateTime deliveryLastRetryAt;

    @Column(name = "delivery_failure_reason", length = 255)
    private String deliveryFailureReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (deliveryRetryCount == null) {
            deliveryRetryCount = 0;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDeliveryAddress() {
        return deliveryAddress;
    }

    public void setDeliveryAddress(String deliveryAddress) {
        this.deliveryAddress = deliveryAddress;
    }

    public Integer getDeliveryRetryCount() {
        return deliveryRetryCount;
    }

    public void setDeliveryRetryCount(Integer deliveryRetryCount) {
        this.deliveryRetryCount = deliveryRetryCount;
    }

    public LocalDateTime getDeliveryLastRetryAt() {
        return deliveryLastRetryAt;
    }

    public void setDeliveryLastRetryAt(LocalDateTime deliveryLastRetryAt) {
        this.deliveryLastRetryAt = deliveryLastRetryAt;
    }

    public String getDeliveryFailureReason() {
        return deliveryFailureReason;
    }

    public void setDeliveryFailureReason(String deliveryFailureReason) {
        this.deliveryFailureReason = deliveryFailureReason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
