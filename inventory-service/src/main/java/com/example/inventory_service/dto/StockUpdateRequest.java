package com.example.inventory_service.dto;

import lombok.Data;

@Data
public class StockUpdateRequest {
    private Long orderId;
    private Long productId;
    private Integer quantity;
}
