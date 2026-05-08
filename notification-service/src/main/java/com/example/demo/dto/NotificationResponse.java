package com.example.demo.dto;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long id,
        Long orderId,
        String channel,
        String recipient,
        String message,
        String status,
        LocalDateTime createdAt
) {
}
