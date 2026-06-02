package com.example.inventory_service.messaging;

import com.example.inventory_service.dto.StockUpdateRequest;
import com.example.inventory_service.exception.ProductNotFoundException;
import com.example.inventory_service.service.InventoryService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class InventoryOrderCreatedConsumer {

    private static final Logger logger = LoggerFactory.getLogger(InventoryOrderCreatedConsumer.class);

    private final InventoryService inventoryService;
    private final ObjectMapper objectMapper;
    private final RabbitTemplate rabbitTemplate;
    private final String inventoryExchange;
    private final String reservedRoutingKey;
    private final String rejectedRoutingKey;
    private final int reserveMaxAttempts;
    private final long reserveRetryDelayMs;

    public InventoryOrderCreatedConsumer(
            InventoryService inventoryService,
            ObjectMapper objectMapper,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbit.exchange}") String inventoryExchange,
            @Value("${app.rabbit.reserved-routing-key:inventory.reserved}") String reservedRoutingKey,
            @Value("${app.rabbit.rejected-routing-key:inventory.rejected}") String rejectedRoutingKey,
            @Value("${app.inventory.reserve-max-attempts:4}") int reserveMaxAttempts,
            @Value("${app.inventory.reserve-retry-delay-ms:200}") long reserveRetryDelayMs) {
        this.inventoryService = inventoryService;
        this.objectMapper = objectMapper;
        this.rabbitTemplate = rabbitTemplate;
        this.inventoryExchange = inventoryExchange;
        this.reservedRoutingKey = reservedRoutingKey;
        this.rejectedRoutingKey = rejectedRoutingKey;
        this.reserveMaxAttempts = reserveMaxAttempts;
        this.reserveRetryDelayMs = reserveRetryDelayMs;
    }

    @RabbitListener(
            queues = "${app.rabbit.order-created-queue:inventory.order-created.queue}",
            concurrency = "${app.rabbit.order-created-consumers:8}")
    public void consumeOrderCreated(Message message) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        logger.info("Evento order.created recibido en inventory-service: {}", payload);

        try {
            JsonNode event = objectMapper.readTree(payload);
            Long orderId = readLong(event, "orderId");
            Long productId = readLong(event, "productId");
            Integer quantity = readInteger(event, "quantity");

            if (orderId == null || productId == null || quantity == null) {
                logger.error("Evento order.created sin datos suficientes: {}", payload);
                throw new IllegalArgumentException("Evento order.created sin datos suficientes");
            }

            StockUpdateRequest request = new StockUpdateRequest();
            request.setOrderId(orderId);
            request.setProductId(productId);
            request.setQuantity(quantity);

            boolean reserved = reserveStockWithRetry(orderId, request);
            if (reserved) {
                publish(reservedRoutingKey, Map.of(
                        "orderId", orderId,
                        "productId", productId,
                        "quantity", quantity,
                        "deliveryAddress", readText(event, "deliveryAddress", "Direccion pendiente"),
                        "status", "INVENTORY_RESERVED"));
                logger.info("Inventario reservado por evento orderId={}, productId={}, quantity={}",
                        orderId, productId, quantity);
            } else {
                publish(rejectedRoutingKey, Map.of(
                        "orderId", orderId,
                        "productId", productId,
                        "quantity", quantity,
                        "reason", "No hay stock suficiente",
                        "status", "INVENTORY_REJECTED"));
                logger.warn("Inventario rechazado por falta de stock orderId={}", orderId);
            }
        } catch (ProductNotFoundException exception) {
            publishRejectedForProductNotFound(payload, exception.getMessage());
        } catch (Exception exception) {
            logger.error("Error procesando order.created en inventory-service: {}", payload, exception);
            throw new IllegalStateException("Error tecnico procesando order.created", exception);
        }
    }

    private boolean reserveStockWithRetry(Long orderId, StockUpdateRequest request) {
        for (int attempt = 1; attempt <= reserveMaxAttempts; attempt++) {
            boolean reserved = inventoryService.reserveStockForOrder(orderId, request);
            if (reserved) {
                if (attempt > 1) {
                    logger.info("Reserva recuperada tras reintento orderId={}, attempt={}/{}",
                            orderId, attempt, reserveMaxAttempts);
                }
                return true;
            }

            if (attempt >= reserveMaxAttempts) {
                logger.warn("Reserva rechazada tras agotar reintentos orderId={}, attempt={}/{}",
                        orderId, attempt, reserveMaxAttempts);
                return false;
            }

            logger.warn("Reserva no confirmada; reintentando orderId={}, attempt={}/{}",
                    orderId, attempt, reserveMaxAttempts);
            sleepBeforeRetry();
        }

        return false;
    }

    private void sleepBeforeRetry() {
        try {
            Thread.sleep(reserveRetryDelayMs);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Reserva de inventario interrumpida durante reintento", exception);
        }
    }

    private void publish(String routingKey, Map<String, ?> event) {
        rabbitTemplate.convertAndSend(inventoryExchange, routingKey, event);
    }

    private void publishRejectedForProductNotFound(String payload, String reason) {
        try {
            JsonNode event = objectMapper.readTree(payload);
            Long orderId = readLong(event, "orderId");
            Long productId = readLong(event, "productId");
            Integer quantity = readInteger(event, "quantity");

            if (orderId == null || productId == null || quantity == null) {
                throw new IllegalArgumentException("Evento order.created sin datos para rechazo");
            }

            publish(rejectedRoutingKey, Map.of(
                    "orderId", orderId,
                    "productId", productId,
                    "quantity", quantity,
                    "reason", reason == null ? "Producto no encontrado" : reason,
                    "status", "INVENTORY_REJECTED"));
            logger.warn("Inventario rechazado por producto inexistente orderId={}, productId={}", orderId, productId);
        } catch (Exception exception) {
            logger.error("No se pudo publicar inventory.rejected para payload={}", payload, exception);
            throw new IllegalStateException("No se pudo publicar inventory.rejected", exception);
        }
    }

    private Long readLong(JsonNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        return node != null && node.canConvertToLong() ? node.asLong() : null;
    }

    private Integer readInteger(JsonNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        return node != null && node.canConvertToInt() ? node.asInt() : null;
    }

    private String readText(JsonNode root, String fieldName, String defaultValue) {
        JsonNode node = root.get(fieldName);
        return node != null && !node.isNull() && !node.asText().isBlank() ? node.asText() : defaultValue;
    }
}
