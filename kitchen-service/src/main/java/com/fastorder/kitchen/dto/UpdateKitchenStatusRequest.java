package com.fastorder.kitchen.dto;

import com.fastorder.kitchen.enums.KitchenOrderStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateKitchenStatusRequest {

    @NotNull(message = "status is required")
    private KitchenOrderStatus status;
}
