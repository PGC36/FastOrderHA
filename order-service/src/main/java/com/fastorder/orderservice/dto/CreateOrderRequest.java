package com.fastorder.orderservice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateOrderRequest {

    @NotNull(message = "productId no puede ser null")
    private Long productId;

    @NotNull(message = "quantity no puede ser null")
    @Min(value = 1, message = "quantity debe ser mayor que 0")
    private Integer quantity;

    @NotBlank(message = "idempotencyKey no puede estar vacio")
    private String idempotencyKey;

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

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }
}
