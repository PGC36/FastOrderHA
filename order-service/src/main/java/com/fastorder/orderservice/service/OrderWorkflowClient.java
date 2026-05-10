package com.fastorder.orderservice.service;

import com.fastorder.orderservice.dto.CreateOrderRequest;
import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.exception.BusinessRuleException;
import com.fastorder.orderservice.exception.InventoryUnavailableException;
import com.fastorder.orderservice.exception.ProductNotFoundException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class OrderWorkflowClient {

    private static final Logger logger = LoggerFactory.getLogger(OrderWorkflowClient.class);
    private static final String DEFAULT_DELIVERY_ADDRESS = "Direccion pendiente";
    private static final String DEFAULT_NOTIFICATION_CHANNEL = "EMAIL";
    private static final String DEFAULT_NOTIFICATION_RECIPIENT = "cliente@fastorder.test";
    private static final Long SYSTEM_DRIVER_ID = 1L;

    private final RestClient restClient;
    private final String inventoryBaseUrl;
    private final String kitchenBaseUrl;
    private final String deliveryBaseUrl;
    private final String notificationBaseUrl;

    public OrderWorkflowClient(
            RestClient restClient,
            @Value("${app.services.inventory-url}") String inventoryBaseUrl,
            @Value("${app.services.kitchen-url}") String kitchenBaseUrl,
            @Value("${app.services.delivery-url}") String deliveryBaseUrl,
            @Value("${app.services.notification-url}") String notificationBaseUrl) {
        this.restClient = restClient;
        this.inventoryBaseUrl = inventoryBaseUrl;
        this.kitchenBaseUrl = kitchenBaseUrl;
        this.deliveryBaseUrl = deliveryBaseUrl;
        this.notificationBaseUrl = notificationBaseUrl;
    }

    public void reserveInventory(CreateOrderRequest request) {
        try {
            restClient.post()
                    .uri(inventoryBaseUrl + "/reserve")
                    .body(Map.of(
                            "productId", request.getProductId(),
                            "quantity", request.getQuantity()))
                    .retrieve()
                    .body(String.class);
            logger.info("Inventario reservado productId={}, quantity={}",
                    request.getProductId(), request.getQuantity());
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 404) {
                throw new ProductNotFoundException("El producto solicitado no existe");
            }
            if (exception.getStatusCode().is4xxClientError()) {
                throw new BusinessRuleException("No hay stock suficiente para el producto solicitado");
            }
            throw new InventoryUnavailableException("inventory-service no pudo reservar stock");
        } catch (RestClientException exception) {
            throw new InventoryUnavailableException("inventory-service no disponible");
        }
    }

    public void releaseInventory(Order order) {
        try {
            restClient.post()
                    .uri(inventoryBaseUrl + "/release")
                    .body(Map.of(
                            "orderId", order.getId(),
                            "productId", order.getProductId(),
                            "quantity", order.getQuantity()))
                    .retrieve()
                    .body(String.class);
            logger.info("Inventario liberado productId={}, quantity={}, orderId={}",
                    order.getProductId(), order.getQuantity(), order.getId());
        } catch (RestClientException exception) {
            logger.error("No se pudo liberar inventario productId={}, quantity={}, orderId={}",
                    order.getProductId(), order.getQuantity(), order.getId(), exception);
        }
    }

    public Long createKitchenOrder(Order order) {
        Map<String, Object> kitchenOrder = post(kitchenBaseUrl, Map.of("orderId", order.getId()), "kitchen-service");
        Long kitchenOrderId = readId(kitchenOrder, "kitchen-service");

        try {
            patch(kitchenBaseUrl + "/" + kitchenOrderId + "/status", Map.of("status", "PREPARING"), "kitchen-service");
            patch(kitchenBaseUrl + "/" + kitchenOrderId + "/status", Map.of("status", "READY"), "kitchen-service");
            return kitchenOrderId;
        } catch (RuntimeException exception) {
            cancelKitchenOrder(kitchenOrderId, "Fallo durante flujo de cocina");
            throw exception;
        }
    }

    public Long createDelivery(Order order, CreateOrderRequest request) {
        String deliveryAddress = request == null
                ? valueOrDefault(order.getDeliveryAddress(), DEFAULT_DELIVERY_ADDRESS)
                : valueOrDefault(request.getDeliveryAddress(), DEFAULT_DELIVERY_ADDRESS);
        Map<String, Object> delivery = post(deliveryBaseUrl, Map.of(
                "orderId", order.getId(),
                "deliveryAddress", deliveryAddress),
                "delivery-service");
        return readId(delivery, "delivery-service");
    }

    public void createAndCompleteDelivery(Order order, CreateOrderRequest request) {
        Map<String, Object> delivery = createDeliveryResponse(order, request);
        Long deliveryId = readId(delivery, "delivery-service");
        completeDeliveryIfNeeded(order, deliveryId, delivery);
    }

    public void createAndCompleteDelivery(Order order) {
        Map<String, Object> delivery = createDeliveryResponse(order, null);
        Long deliveryId = readId(delivery, "delivery-service");
        completeDeliveryIfNeeded(order, deliveryId, delivery);
    }

    private Map<String, Object> createDeliveryResponse(Order order, CreateOrderRequest request) {
        String deliveryAddress = request == null
                ? valueOrDefault(order.getDeliveryAddress(), DEFAULT_DELIVERY_ADDRESS)
                : valueOrDefault(request.getDeliveryAddress(), DEFAULT_DELIVERY_ADDRESS);
        return post(deliveryBaseUrl, Map.of(
                "orderId", order.getId(),
                "deliveryAddress", deliveryAddress),
                "delivery-service");
    }

    private void completeDeliveryIfNeeded(Order order, Long deliveryId, Map<String, Object> delivery) {
        if (isDeliveryAlreadyCompleted(delivery)) {
            logger.info("Entrega ya estaba completada deliveryId={}, orderId={}", deliveryId, order.getId());
            return;
        }

        completeDelivery(order, deliveryId);
    }

    private void completeDelivery(Order order, Long deliveryId) {

        try {
            patch(deliveryBaseUrl + "/" + deliveryId + "/assign",
                    Map.of("driverId", SYSTEM_DRIVER_ID),
                    "delivery-service");
            patch(deliveryBaseUrl + "/" + deliveryId + "/pick-up", null, "delivery-service");
            patch(deliveryBaseUrl + "/" + deliveryId + "/in-transit", null, "delivery-service");
            patch(deliveryBaseUrl + "/" + deliveryId + "/deliver", null, "delivery-service");
            logger.info("Entrega completada automaticamente deliveryId={}, orderId={}", deliveryId, order.getId());
        } catch (RuntimeException exception) {
            cancelDelivery(deliveryId, "Fallo durante flujo automatico de delivery");
            failDelivery(deliveryId, "Fallo durante flujo automatico de delivery");
            throw exception;
        }
    }

    public void createNotification(Order order, CreateOrderRequest request) {
        post(notificationBaseUrl, Map.of(
                "orderId", order.getId(),
                "channel", valueOrDefault(request.getNotificationChannel(), DEFAULT_NOTIFICATION_CHANNEL),
                "recipient", valueOrDefault(request.getNotificationRecipient(), DEFAULT_NOTIFICATION_RECIPIENT),
                "message", "Pedido " + order.getId() + " de Pollo Frito recibido"),
                "notification-service");
    }

    public void cancelKitchenOrder(Long kitchenOrderId, String reason) {
        if (kitchenOrderId == null) {
            return;
        }

        try {
            patch(kitchenBaseUrl + "/" + kitchenOrderId + "/status", Map.of("status", "CANCELLED"), "kitchen-service");
            logger.info("Orden de cocina cancelada kitchenOrderId={}, reason={}", kitchenOrderId, reason);
        } catch (RuntimeException exception) {
            logger.error("No se pudo cancelar orden de cocina kitchenOrderId={}, reason={}",
                    kitchenOrderId, reason, exception);
        }
    }

    public void cancelDelivery(Long deliveryId, String reason) {
        if (deliveryId == null) {
            return;
        }

        try {
            patch(deliveryBaseUrl + "/" + deliveryId + "/cancel", Map.of("reason", reason), "delivery-service");
            logger.info("Entrega cancelada deliveryId={}, reason={}", deliveryId, reason);
        } catch (RuntimeException exception) {
            logger.error("No se pudo cancelar entrega deliveryId={}, reason={}", deliveryId, reason, exception);
        }
    }

    public void failDelivery(Long deliveryId, String reason) {
        if (deliveryId == null) {
            return;
        }

        try {
            patch(deliveryBaseUrl + "/" + deliveryId + "/fail", Map.of("reason", reason), "delivery-service");
            logger.info("Entrega marcada como fallida deliveryId={}, reason={}", deliveryId, reason);
        } catch (RuntimeException exception) {
            logger.error("No se pudo marcar entrega como fallida deliveryId={}, reason={}",
                    deliveryId, reason, exception);
        }
    }

    private Map<String, Object> post(String url, Map<String, ?> body, String serviceName) {
        try {
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            logger.info("{} procesado correctamente para body={}", serviceName, body);
            return response;
        } catch (RestClientResponseException exception) {
            throw new BusinessRuleException(serviceName + " rechazo la operacion");
        } catch (RestClientException exception) {
            throw new InventoryUnavailableException(serviceName + " no disponible");
        }
    }

    private void patch(String url, Map<String, ?> body, String serviceName) {
        try {
            RestClient.RequestBodySpec request = restClient.patch().uri(url);
            if (body != null) {
                request.body(body);
            }
            request.retrieve().toBodilessEntity();
            logger.info("{} actualizado correctamente url={}, body={}", serviceName, url, body);
        } catch (RestClientResponseException exception) {
            throw new BusinessRuleException(serviceName + " rechazo la actualizacion");
        } catch (RestClientException exception) {
            throw new InventoryUnavailableException(serviceName + " no disponible");
        }
    }

    private Long readId(Map<String, Object> response, String serviceName) {
        if (response == null || !(response.get("id") instanceof Number id)) {
            throw new InventoryUnavailableException(serviceName + " no devolvio id");
        }
        return id.longValue();
    }

    private boolean isDeliveryAlreadyCompleted(Map<String, Object> delivery) {
        return delivery != null && "DELIVERED".equals(String.valueOf(delivery.get("status")));
    }

    private String valueOrDefault(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
