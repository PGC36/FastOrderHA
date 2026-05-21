package com.fastorder.delivery.messaging;

import com.fastorder.delivery.dto.request.CreateDeliveryRequest;
import com.fastorder.delivery.model.DeliveryOrder;
import com.fastorder.delivery.service.DeliveryOrderService;
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
public class DeliveryKitchenReadyConsumer {

    private static final Logger logger = LoggerFactory.getLogger(DeliveryKitchenReadyConsumer.class);
    private static final Long SYSTEM_DRIVER_ID = 1L;

    private final DeliveryOrderService deliveryOrderService;
    private final ObjectMapper objectMapper;
    private final RabbitTemplate rabbitTemplate;
    private final String deliveryExchange;
    private final String completedRoutingKey;
    private final String failedRoutingKey;
    private final String notificationExchange;
    private final String notificationRoutingKey;

    public DeliveryKitchenReadyConsumer(
            DeliveryOrderService deliveryOrderService,
            ObjectMapper objectMapper,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbit.exchange}") String deliveryExchange,
            @Value("${app.rabbit.completed-routing-key:delivery.completed}") String completedRoutingKey,
            @Value("${app.rabbit.failed-routing-key:delivery.failed}") String failedRoutingKey,
            @Value("${app.rabbit.notification-exchange:notification.exchange}") String notificationExchange,
            @Value("${app.rabbit.notification-routing-key:notification.created}") String notificationRoutingKey) {
        this.deliveryOrderService = deliveryOrderService;
        this.objectMapper = objectMapper;
        this.rabbitTemplate = rabbitTemplate;
        this.deliveryExchange = deliveryExchange;
        this.completedRoutingKey = completedRoutingKey;
        this.failedRoutingKey = failedRoutingKey;
        this.notificationExchange = notificationExchange;
        this.notificationRoutingKey = notificationRoutingKey;
    }

    @RabbitListener(
            queues = "${app.rabbit.kitchen-ready-queue:delivery.kitchen-ready.queue}",
            concurrency = "${app.rabbit.kitchen-ready-consumers:8}")
    public void consumeKitchenReady(Message message) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        logger.info("Evento kitchen.ready recibido en delivery-service: {}", payload);

        try {
            JsonNode event = objectMapper.readTree(payload);
            Long orderId = readLong(event, "orderId");
            Long productId = readLong(event, "productId");
            Integer quantity = readInteger(event, "quantity");
            if (orderId == null) {
                logger.error("Evento kitchen.ready sin orderId: {}", payload);
                throw new IllegalArgumentException("Evento kitchen.ready sin orderId");
            }
            if (productId == null || quantity == null) {
                logger.error("Evento kitchen.ready sin producto/cantidad: {}", payload);
                throw new IllegalArgumentException("Evento kitchen.ready sin producto/cantidad");
            }

            CreateDeliveryRequest createRequest = new CreateDeliveryRequest();
            createRequest.setOrderId(orderId);
            createRequest.setDeliveryAddress(readText(event, "deliveryAddress", "Direccion pendiente"));

            DeliveryOrder delivery = deliveryOrderService.createCompletedSystemDelivery(createRequest, SYSTEM_DRIVER_ID);

            rabbitTemplate.convertAndSend(deliveryExchange, completedRoutingKey, Map.of(
                    "orderId", orderId,
                    "deliveryId", delivery.getId(),
                    "productId", productId,
                    "quantity", quantity,
                    "status", "DELIVERY_COMPLETED"));

            rabbitTemplate.convertAndSend(notificationExchange, notificationRoutingKey, Map.of(
                    "orderId", orderId,
                    "channel", "EMAIL",
                    "recipient", "cliente@fastorder.test",
                    "message", "Pedido " + orderId + " entregado correctamente"));

            logger.info("Delivery completado por evento orderId={}, deliveryId={}", orderId, delivery.getId());
        } catch (Exception exception) {
            logger.warn("Error tecnico procesando kitchen.ready; Rabbit reintentara el mensaje: {}", payload,
                    exception);
            throw new IllegalStateException("Error tecnico procesando kitchen.ready", exception);
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
