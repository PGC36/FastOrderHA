package com.fastorder.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CancelDeliveryRequest {

    @NotBlank(message = "reason is required")
    @Size(max = 255, message = "reason must not exceed 255 characters")
    private String reason;
}
