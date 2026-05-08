package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateNotificationRequest(
        @NotNull Long orderId,
        @NotBlank @Size(max = 30) String channel,
        @NotBlank @Size(max = 150) String recipient,
        @NotBlank String message
) {
}
