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
    private static final String PENDING_STATUS = "PENDING";
    private static final String PROCESSED_STATUS = "PROCESSED";

    private final NotificationRepository notificationRepository;
    private final NotificationEventPublisher notificationEventPublisher;

    public NotificationResponse create(CreateNotificationRequest request) {
        var existingNotification = notificationRepository.findByOrderId(request.orderId());
        if (existingNotification.isPresent()) {
            Notification notification = existingNotification.get();
            if (!PROCESSED_STATUS.equals(notification.getStatus())) {
                publishNotification(notification);
            }
            return toResponse(notification);
        }

        Notification notification = Notification.builder()
                .orderId(request.orderId())
                .channel(request.channel())
                .recipient(request.recipient())
                .message(request.message())
                .status(PENDING_STATUS)
                .createdAt(LocalDateTime.now())
                .build();

        Notification saved = notificationRepository.save(notification);
        publishNotification(saved);
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

    private void publishNotification(Notification notification) {
        notificationEventPublisher.publishNotificationCreated(new NotificationCreatedEvent(
                notification.getId(),
                notification.getOrderId(),
                notification.getChannel(),
                notification.getRecipient(),
                notification.getStatus(),
                notification.getCreatedAt()
        ));
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
