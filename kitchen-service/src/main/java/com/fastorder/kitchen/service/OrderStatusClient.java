package com.fastorder.kitchen.service;

import com.fastorder.kitchen.enums.KitchenOrderStatus;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class OrderStatusClient {

    private static final Logger logger = LoggerFactory.getLogger(OrderStatusClient.class);

    private final RestClient restClient;
    private final String orderBaseUrl;

    public OrderStatusClient(
            RestClient restClient,
            @Value("${app.services.order-url}") String orderBaseUrl) {
        this.restClient = restClient;
        this.orderBaseUrl = orderBaseUrl;
    }

    public void syncKitchenStatus(Long orderId, KitchenOrderStatus kitchenStatus) {
        String orderStatus = switch (kitchenStatus) {
            case PREPARING -> "IN_KITCHEN";
            case READY -> "READY_FOR_DELIVERY";
            case CANCELLED -> "CANCELLED";
            default -> null;
        };

        if (orderStatus == null) {
            return;
        }

        try {
            restClient.patch()
                    .uri(orderBaseUrl + "/" + orderId + "/status")
                    .body(Map.of("status", orderStatus))
                    .retrieve()
                    .toBodilessEntity();
            logger.info("Order status synced from kitchen. orderId={}, status={}", orderId, orderStatus);
        } catch (RestClientException exception) {
            logger.warn("No se pudo sincronizar estado de order-service desde kitchen. orderId={}, status={}",
                    orderId, orderStatus);
        }
    }
}
