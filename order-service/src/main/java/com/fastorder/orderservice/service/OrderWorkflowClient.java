package com.fastorder.orderservice.service;

import com.fastorder.orderservice.dto.CreateOrderRequest;
import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.exception.BusinessRuleException;
import com.fastorder.orderservice.exception.InventoryUnavailableException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
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
            if (isBusinessError(exception.getStatusCode())) {
                throw new BusinessRuleException("No hay stock suficiente para el producto solicitado");
            }
            throw new InventoryUnavailableException("inventory-service no pudo reservar stock");
        } catch (RestClientException exception) {
            throw new InventoryUnavailableException("inventory-service no disponible");
        }
    }

    public void createKitchenOrder(Order order) {
        post(kitchenBaseUrl, Map.of("orderId", order.getId()), "kitchen-service");
    }

    public void createDelivery(Order order, CreateOrderRequest request) {
        post(deliveryBaseUrl, Map.of(
                "orderId", order.getId(),
                "deliveryAddress", valueOrDefault(request.getDeliveryAddress(), DEFAULT_DELIVERY_ADDRESS)),
                "delivery-service");
    }

    public void createNotification(Order order, CreateOrderRequest request) {
        post(notificationBaseUrl, Map.of(
                "orderId", order.getId(),
                "channel", valueOrDefault(request.getNotificationChannel(), DEFAULT_NOTIFICATION_CHANNEL),
                "recipient", valueOrDefault(request.getNotificationRecipient(), DEFAULT_NOTIFICATION_RECIPIENT),
                "message", "Pedido " + order.getId() + " de Pollo Frito recibido"),
                "notification-service");
    }

    private void post(String url, Map<String, ?> body, String serviceName) {
        try {
            restClient.post()
                    .uri(url)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            logger.info("{} procesado correctamente para body={}", serviceName, body);
        } catch (RestClientResponseException exception) {
            throw new BusinessRuleException(serviceName + " rechazo la operacion");
        } catch (RestClientException exception) {
            throw new InventoryUnavailableException(serviceName + " no disponible");
        }
    }

    private boolean isBusinessError(HttpStatusCode statusCode) {
        return statusCode.is4xxClientError();
    }

    private String valueOrDefault(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
