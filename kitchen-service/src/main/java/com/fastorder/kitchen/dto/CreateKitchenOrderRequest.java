package com.fastorder.kitchen.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateKitchenOrderRequest {

    @NotNull(message = "orderId is required")
    private Long orderId;
}
