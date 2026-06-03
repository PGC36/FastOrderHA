package com.fastorder.delivery.service;

import com.fastorder.delivery.enums.DeliveryStatus;
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

    public void syncDeliveryStatus(Long orderId, DeliveryStatus deliveryStatus) {
        String orderStatus = switch (deliveryStatus) {
            case ASSIGNED, PICKED_UP, IN_TRANSIT -> "IN_DELIVERY";
            case FAILED -> "DELIVERY_FAILED";
            case CANCELLED -> "DELIVERY_CANCELLED";
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
            logger.info("Order status synced from delivery. orderId={}, status={}", orderId, orderStatus);
        } catch (RestClientException exception) {
            logger.warn("No se pudo sincronizar estado de order-service desde delivery. orderId={}, status={}",
                    orderId, orderStatus);
        }
    }
}
