package com.fastorder.orderservice.dto;

import com.fastorder.orderservice.entity.Order;
import java.time.LocalDateTime;

public class OrderResponse {

    private Long id;
    private String idempotencyKey;
    private Long productId;
    private Integer quantity;
    private String status;
    private String deliveryAddress;
    private Integer deliveryRetryCount;
    private LocalDateTime deliveryLastRetryAt;
    private String deliveryFailureReason;
    private LocalDateTime createdAt;
    private String message;

    public static OrderResponse fromEntity(Order order) {
        OrderResponse response = new OrderResponse();
        response.setId(order.getId());
        response.setIdempotencyKey(order.getIdempotencyKey());
        response.setProductId(order.getProductId());
        response.setQuantity(order.getQuantity());
        response.setStatus(order.getStatus());
        response.setDeliveryAddress(order.getDeliveryAddress());
        response.setDeliveryRetryCount(order.getDeliveryRetryCount());
        response.setDeliveryLastRetryAt(order.getDeliveryLastRetryAt());
        response.setDeliveryFailureReason(order.getDeliveryFailureReason());
        response.setCreatedAt(order.getCreatedAt());
        return response;
    }

    public static OrderResponse fromEntity(Order order, String message) {
        OrderResponse response = fromEntity(order);
        response.setMessage(message);
        return response;
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

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
