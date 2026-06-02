package com.example.inventory_service.service;

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

    public OrderStatusClient(RestClient restClient, @Value("${app.services.order-url}") String orderBaseUrl) {
        this.restClient = restClient;
        this.orderBaseUrl = orderBaseUrl;
    }

    public void markOrderCompleted(Long orderId) {
        try {
            restClient.patch()
                    .uri(orderBaseUrl + "/" + orderId + "/status")
                    .body(Map.of("status", "COMPLETED"))
                    .retrieve()
                    .toBodilessEntity();
            logger.info("Order status synced from inventory. orderId={}, status=COMPLETED", orderId);
        } catch (RestClientException exception) {
            logger.warn("No se pudo sincronizar estado COMPLETED de order-service desde inventory. orderId={}", orderId);
            throw exception;
        }
    }
}
