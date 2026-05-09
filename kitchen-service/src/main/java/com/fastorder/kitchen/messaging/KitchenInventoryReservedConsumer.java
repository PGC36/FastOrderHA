package com.fastorder.kitchen.messaging;

import com.fastorder.kitchen.dto.CreateKitchenOrderRequest;
import com.fastorder.kitchen.dto.KitchenOrderResponse;
import com.fastorder.kitchen.dto.UpdateKitchenStatusRequest;
import com.fastorder.kitchen.enums.KitchenOrderStatus;
import com.fastorder.kitchen.service.KitchenOrderService;
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
public class KitchenInventoryReservedConsumer {

    private static final Logger logger = LoggerFactory.getLogger(KitchenInventoryReservedConsumer.class);

    private final KitchenOrderService kitchenOrderService;
    private final ObjectMapper objectMapper;
    private final RabbitTemplate rabbitTemplate;
    private final String kitchenExchange;
    private final String readyRoutingKey;
    private final String failedRoutingKey;

    public KitchenInventoryReservedConsumer(
            KitchenOrderService kitchenOrderService,
            ObjectMapper objectMapper,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbit.exchange}") String kitchenExchange,
            @Value("${app.rabbit.ready-routing-key:kitchen.ready}") String readyRoutingKey,
            @Value("${app.rabbit.failed-routing-key:kitchen.failed}") String failedRoutingKey) {
        this.kitchenOrderService = kitchenOrderService;
        this.objectMapper = objectMapper;
        this.rabbitTemplate = rabbitTemplate;
        this.kitchenExchange = kitchenExchange;
        this.readyRoutingKey = readyRoutingKey;
        this.failedRoutingKey = failedRoutingKey;
    }

    @RabbitListener(
            queues = "${app.rabbit.inventory-reserved-queue:kitchen.inventory-reserved.queue}",
            concurrency = "${app.rabbit.inventory-reserved-consumers:8}")
    public void consumeInventoryReserved(Message message) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        logger.info("Evento inventory.reserved recibido en kitchen-service: {}", payload);

        try {
            JsonNode event = objectMapper.readTree(payload);
            Long orderId = readLong(event, "orderId");
            if (orderId == null) {
                logger.error("Evento inventory.reserved sin orderId: {}", payload);
                throw new IllegalArgumentException("Evento inventory.reserved sin orderId");
            }

            CreateKitchenOrderRequest createRequest = new CreateKitchenOrderRequest();
            createRequest.setOrderId(orderId);
            KitchenOrderResponse kitchenOrder = kitchenOrderService.createKitchenOrder(createRequest);

            updateStatus(kitchenOrder.getId(), KitchenOrderStatus.PREPARING);
            updateStatus(kitchenOrder.getId(), KitchenOrderStatus.READY);

            publish(readyRoutingKey, Map.of(
                    "orderId", orderId,
                    "kitchenOrderId", kitchenOrder.getId(),
                    "productId", readLong(event, "productId"),
                    "quantity", readInteger(event, "quantity"),
                    "deliveryAddress", readText(event, "deliveryAddress", "Direccion pendiente"),
                    "status", "KITCHEN_READY"));
            logger.info("Orden de cocina lista por evento orderId={}, kitchenOrderId={}",
                    orderId, kitchenOrder.getId());
        } catch (Exception exception) {
            logger.error("Error procesando inventory.reserved en kitchen-service: {}", payload, exception);
            publishFailure(payload, exception.getMessage());
        }
    }

    private void updateStatus(Long kitchenOrderId, KitchenOrderStatus status) {
        UpdateKitchenStatusRequest request = new UpdateKitchenStatusRequest();
        request.setStatus(status);
        kitchenOrderService.updateStatus(kitchenOrderId, request);
    }

    private void publish(String routingKey, Map<String, ?> event) {
        rabbitTemplate.convertAndSend(kitchenExchange, routingKey, event);
    }

    private void publishFailure(String payload, String reason) {
        try {
            JsonNode event = objectMapper.readTree(payload);
            Long orderId = readLong(event, "orderId");
            if (orderId != null) {
                publish(failedRoutingKey, Map.of(
                        "orderId", orderId,
                        "reason", reason == null ? "Kitchen fallo" : reason,
                        "status", "KITCHEN_FAILED"));
            }
        } catch (Exception ignored) {
            logger.error("No se pudo publicar kitchen.failed para payload={}", payload);
            throw new IllegalStateException("No se pudo publicar kitchen.failed", ignored);
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
