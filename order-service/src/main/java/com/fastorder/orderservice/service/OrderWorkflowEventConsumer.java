package com.fastorder.orderservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class OrderWorkflowEventConsumer {

    private static final Logger logger = LoggerFactory.getLogger(OrderWorkflowEventConsumer.class);

    private final OrderService orderService;
    private final ObjectMapper objectMapper;

    public OrderWorkflowEventConsumer(OrderService orderService, ObjectMapper objectMapper) {
        this.orderService = orderService;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(
            queues = "${app.rabbit.inventory-rejected-queue:order.inventory-rejected.queue}",
            concurrency = "${app.rabbit.workflow-consumers:8}")
    public void handleInventoryRejected(Message message) {
        JsonNode event = read(message, "inventory.rejected");
        Long orderId = readLong(event, "orderId");
        if (orderId != null) {
            orderService.cancelOrderById(orderId, readText(event, "reason", "Inventario rechazado"));
        }
    }

    @RabbitListener(
            queues = "${app.rabbit.kitchen-failed-queue:order.kitchen-failed.queue}",
            concurrency = "${app.rabbit.workflow-consumers:8}")
    public void handleKitchenFailed(Message message) {
        JsonNode event = read(message, "kitchen.failed");
        Long orderId = readLong(event, "orderId");
        if (orderId != null) {
            orderService.cancelOrderById(orderId, readText(event, "reason", "Kitchen fallo"));
        }
    }

    @RabbitListener(
            queues = "${app.rabbit.delivery-completed-queue:order.delivery-completed.queue}",
            concurrency = "${app.rabbit.workflow-consumers:8}")
    public void handleDeliveryCompleted(Message message) {
        JsonNode event = read(message, "delivery.completed");
        Long orderId = readLong(event, "orderId");
        if (orderId != null) {
            orderService.completeOrderById(orderId);
        }
    }

    @RabbitListener(
            queues = "${app.rabbit.delivery-failed-queue:order.delivery-failed.queue}",
            concurrency = "${app.rabbit.workflow-consumers:8}")
    public void handleDeliveryFailed(Message message) {
        JsonNode event = read(message, "delivery.failed");
        Long orderId = readLong(event, "orderId");
        if (orderId != null) {
            orderService.markDeliveryRetryPendingById(orderId, readText(event, "reason", "Delivery fallo"));
        }
    }

    private JsonNode read(Message message, String eventName) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        try {
            logger.info("Evento {} recibido: {}", eventName, payload);
            return objectMapper.readTree(payload);
        } catch (Exception exception) {
            logger.error("No se pudo leer evento {} payload={}", eventName, payload, exception);
            throw new IllegalArgumentException("No se pudo leer evento " + eventName, exception);
        }
    }

    private Long readLong(JsonNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        return node != null && node.canConvertToLong() ? node.asLong() : null;
    }

    private String readText(JsonNode root, String fieldName, String defaultValue) {
        JsonNode node = root.get(fieldName);
        return node != null && !node.isNull() && !node.asText().isBlank() ? node.asText() : defaultValue;
    }
}
