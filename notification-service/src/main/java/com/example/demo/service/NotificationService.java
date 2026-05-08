package com.example.demo.service;

import com.example.demo.dto.CreateNotificationRequest;
import com.example.demo.dto.NotificationResponse;
import com.example.demo.entity.Notification;
import com.example.demo.exception.NotificationNotFoundException;
import com.example.demo.messaging.NotificationCreatedEvent;
import com.example.demo.messaging.NotificationEventPublisher;
import com.example.demo.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private final NotificationRepository notificationRepository;
    private final NotificationEventPublisher notificationEventPublisher;

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
        notificationEventPublisher.publishNotificationCreated(new NotificationCreatedEvent(
                saved.getId(),
                saved.getOrderId(),
                saved.getChannel(),
                saved.getRecipient(),
                saved.getStatus(),
                saved.getCreatedAt()
        ));
        log.info("Notification created successfully. id={}, orderId={}, channel={}",
                saved.getId(), saved.getOrderId(), saved.getChannel());
        return toResponse(saved);
    }

    public NotificationResponse getById(Long id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new NotificationNotFoundException(id));
        log.info("Notification fetched successfully. id={}", id);
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
