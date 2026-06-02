package com.example.inventory_service.repository.projection;

public interface DeliveredOrderProjection {

    Long getOrderId();

    Long getProductId();

    Integer getQuantity();

    Boolean getHasReservation();
}
