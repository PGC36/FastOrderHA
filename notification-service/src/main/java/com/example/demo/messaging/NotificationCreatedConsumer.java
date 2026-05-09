package com.example.demo.messaging;

import com.example.demo.entity.Notification;
import com.example.demo.repository.NotificationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class NotificationCreatedConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificationCreatedConsumer.class);

    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;

    @RabbitListener(
            queues = "${app.rabbit.queue:notification.created.queue}",
            concurrency = "${app.rabbit.created-consumers:8}")
    @Transactional
    public void consumeNotification(Message message) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        log.info("Mensaje recibido desde notification.created.queue: {}", payload);

        try {
            JsonNode root = objectMapper.readTree(payload);
            Long notificationId = readLong(root, "notificationId");

            if (notificationId != null) {
                processExistingNotification(notificationId, root);
                return;
            }

            processNewNotification(root);
        } catch (Exception ex) {
            log.error("Error al procesar mensaje desde notification.created.queue: {}", payload, ex);
        }
    }

    private void processExistingNotification(Long notificationId, JsonNode root) {
        notificationRepository.findById(notificationId)
                .ifPresentOrElse(notification -> {
                    notification.setStatus("PROCESSED");
                    notificationRepository.save(notification);
                    log.info("Notificacion procesada correctamente. id={}, orderId={}",
                            notification.getId(), notification.getOrderId());
                }, () -> {
                    log.error("No se encontro notificacion existente. Se intentara registrar desde el evento. id={}",
                            notificationId);
                    processNewNotification(root);
                });
    }

    private void processNewNotification(JsonNode root) {
        Long orderId = readLong(root, "orderId");
        String channel = readText(root, "channel");
        String recipient = readText(root, "recipient");
        String message = readText(root, "message");

        if (orderId == null || isBlank(channel) || isBlank(recipient)) {
            log.error("Mensaje recibido sin datos suficientes para guardar notificacion: {}", root);
            return;
        }

        if (isBlank(message)) {
            message = "Notificacion generada para la orden " + orderId;
        }

        Notification saved = notificationRepository.save(Notification.builder()
                .orderId(orderId)
                .channel(channel)
                .recipient(recipient)
                .message(message)
                .status("PROCESSED")
                .createdAt(LocalDateTime.now())
                .build());

        log.info("Notificacion procesada correctamente. id={}, orderId={}",
                saved.getId(), saved.getOrderId());
    }

    private Long readLong(JsonNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        return node != null && node.canConvertToLong() ? node.asLong() : null;
    }

    private String readText(JsonNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        return node != null && !node.isNull() ? node.asText() : null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
