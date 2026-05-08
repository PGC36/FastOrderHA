package com.fastorder.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateDeliveryRequest {

    @NotNull(message = "orderId is required")
    @Positive(message = "orderId must be positive")
    private Long orderId;

    @NotBlank(message = "deliveryAddress is required")
    @Size(max = 500, message = "deliveryAddress must not exceed 500 characters")
    private String deliveryAddress;
}
