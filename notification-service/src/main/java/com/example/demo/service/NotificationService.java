package com.example.demo.service;

import com.example.demo.dto.CreateNotificationRequest;
import com.example.demo.dto.NotificationResponse;
import com.example.demo.entity.Notification;
import com.example.demo.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationResponse create(CreateNotificationRequest request) {
        Notification notification = Notification.builder()
                .orderId(request.orderId())
                .channel(request.channel())
                .recipient(request.recipient())
                .message(request.message())
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build();

        Notification saved = notificationRepository.save(notification);
        return toResponse(saved);
    }

    public NotificationResponse getById(Long id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found: " + id));
        return toResponse(notification);
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getOrderId(),
                notification.getChannel(),
                notification.getRecipient(),
                notification.getMessage(),
                notification.getStatus(),
                notification.getCreatedAt()
        );
    }
}
