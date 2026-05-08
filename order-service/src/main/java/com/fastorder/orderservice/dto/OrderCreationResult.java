package com.fastorder.orderservice.dto;

public class OrderCreationResult {

    private final OrderResponse response;
    private final boolean created;

    public OrderCreationResult(OrderResponse response, boolean created) {
        this.response = response;
        this.created = created;
    }

    public OrderResponse getResponse() {
        return response;
    }

    public boolean isCreated() {
        return created;
    }
}
