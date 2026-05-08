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

    public void createKitchenOrder(Order order) {
        Map<String, Object> kitchenOrder = post(kitchenBaseUrl, Map.of("orderId", order.getId()), "kitchen-service");
        Long kitchenOrderId = readId(kitchenOrder, "kitchen-service");

        patch(kitchenBaseUrl + "/" + kitchenOrderId + "/status", Map.of("status", "PREPARING"), "kitchen-service");
        patch(kitchenBaseUrl + "/" + kitchenOrderId + "/status", Map.of("status", "READY"), "kitchen-service");
    }

    public void createDelivery(Order order, CreateOrderRequest request) {
        Map<String, Object> delivery = post(deliveryBaseUrl, Map.of(
                "orderId", order.getId(),
                "deliveryAddress", valueOrDefault(request.getDeliveryAddress(), DEFAULT_DELIVERY_ADDRESS)),
                "delivery-service");
        Long deliveryId = readId(delivery, "delivery-service");

        patch(deliveryBaseUrl + "/" + deliveryId + "/assign", Map.of("driverId", 1), "delivery-service");
        patch(deliveryBaseUrl + "/" + deliveryId + "/pick-up", null, "delivery-service");
        patch(deliveryBaseUrl + "/" + deliveryId + "/in-transit", null, "delivery-service");
        patch(deliveryBaseUrl + "/" + deliveryId + "/deliver", null, "delivery-service");
    }

    public void createNotification(Order order, CreateOrderRequest request) {
        post(notificationBaseUrl, Map.of(
                "orderId", order.getId(),
                "channel", valueOrDefault(request.getNotificationChannel(), DEFAULT_NOTIFICATION_CHANNEL),
                "recipient", valueOrDefault(request.getNotificationRecipient(), DEFAULT_NOTIFICATION_RECIPIENT),
                "message", "Pedido " + order.getId() + " de Pollo Frito recibido"),
                "notification-service");
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

    private String valueOrDefault(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
