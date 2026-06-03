package com.example.inventory_service.repository.projection;

public interface CompletedReservationProjection {

    Long getOrderId();

    Long getProductId();

    Integer getQuantity();
}
