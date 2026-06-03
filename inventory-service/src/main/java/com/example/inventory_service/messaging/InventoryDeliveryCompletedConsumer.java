package com.example.inventory_service.messaging;

import com.example.inventory_service.dto.StockUpdateRequest;
import com.example.inventory_service.service.InventoryService;
import com.example.inventory_service.service.InventoryService.ConfirmSaleResult;
import com.example.inventory_service.service.OrderStatusClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class InventoryDeliveryCompletedConsumer {

    private static final Logger logger = LoggerFactory.getLogger(InventoryDeliveryCompletedConsumer.class);

    private final InventoryService inventoryService;
    private final OrderStatusClient orderStatusClient;
    private final ObjectMapper objectMapper;

    public InventoryDeliveryCompletedConsumer(
            InventoryService inventoryService,
            OrderStatusClient orderStatusClient,
            ObjectMapper objectMapper) {
        this.inventoryService = inventoryService;
        this.orderStatusClient = orderStatusClient;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(
            queues = "${app.rabbit.delivery-completed-queue:inventory.delivery-completed.queue}",
            concurrency = "${app.rabbit.delivery-completed-consumers:8}")
    public void consumeDeliveryCompleted(Message message) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        logger.info("Evento delivery.completed recibido en inventory-service: {}", payload);

        try {
            JsonNode event = objectMapper.readTree(payload);
            Long orderId = readLong(event, "orderId");
            Long productId = readLong(event, "productId");
            Integer quantity = readInteger(event, "quantity");

            if (orderId == null || productId == null || quantity == null) {
                logger.error("Evento delivery.completed sin datos suficientes: {}", payload);
                throw new IllegalArgumentException("Evento delivery.completed sin datos suficientes");
            }

            StockUpdateRequest request = new StockUpdateRequest();
            request.setOrderId(orderId);
            request.setProductId(productId);
            request.setQuantity(quantity);

            ConfirmSaleResult confirmSaleResult = inventoryService.confirmSale(orderId, request);
            if (confirmSaleResult == ConfirmSaleResult.CONFIRMED) {
                logger.info("Venta confirmada en inventario orderId={}, productId={}, quantity={}",
                        orderId, productId, quantity);
                orderStatusClient.markOrderCompleted(orderId);
                return;
            }

            if (confirmSaleResult == ConfirmSaleResult.ALREADY_CONFIRMED) {
                logger.info("Venta ya habia sido confirmada previamente orderId={}", orderId);
                orderStatusClient.markOrderCompleted(orderId);
                return;
            }

            logger.warn("Delivery completado sin reserva lista para confirmar venta orderId={}, productId={}, quantity={}",
                    orderId, productId, quantity);
            throw new IllegalStateException("La venta aun no puede confirmarse para la orden " + orderId);
        } catch (Exception exception) {
            logger.error("Error procesando delivery.completed en inventory-service: {}", payload, exception);
            throw new IllegalStateException("Error tecnico procesando delivery.completed", exception);
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
}
