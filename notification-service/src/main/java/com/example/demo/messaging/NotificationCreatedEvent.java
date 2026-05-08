package com.example.demo.messaging;

import java.time.LocalDateTime;

public record NotificationCreatedEvent(
        Long notificationId,
        Long orderId,
        String channel,
        String recipient,
        String status,
        LocalDateTime createdAt
) {
}
