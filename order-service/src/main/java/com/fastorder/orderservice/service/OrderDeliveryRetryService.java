package com.fastorder.orderservice.service;

import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.exception.BusinessRuleException;
import com.fastorder.orderservice.exception.InventoryUnavailableException;
import com.fastorder.orderservice.repository.OrderRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderDeliveryRetryService {

    private static final Logger logger = LoggerFactory.getLogger(OrderDeliveryRetryService.class);
    private static final String DELIVERY_FAILED_STATUS = "DELIVERY_FAILED";
    private static final String DELIVERY_RETRY_PENDING_STATUS = "DELIVERY_RETRY_PENDING";
    private static final String DELIVERY_ABANDONED_STATUS = "DELIVERY_ABANDONED";
    private static final String COMPLETED_STATUS = "COMPLETED";

    private final OrderRepository orderRepository;
    private final OrderWorkflowClient orderWorkflowClient;
    private final int maxAttempts;

    public OrderDeliveryRetryService(
            OrderRepository orderRepository,
            OrderWorkflowClient orderWorkflowClient,
            @Value("${app.delivery-retry.max-attempts:3}") int maxAttempts) {
        this.orderRepository = orderRepository;
        this.orderWorkflowClient = orderWorkflowClient;
        this.maxAttempts = maxAttempts;
    }

    @Scheduled(fixedDelayString = "${app.delivery-retry.fixed-delay-ms:30000}",
            initialDelayString = "${app.delivery-retry.initial-delay-ms:10000}")
    @Transactional
    public void retryFailedDeliveries() {
        List<Order> failedOrders = orderRepository.findByStatusIn(
                List.of(DELIVERY_RETRY_PENDING_STATUS, DELIVERY_FAILED_STATUS));
        if (failedOrders.isEmpty()) {
            return;
        }

        logger.info("Reintentando delivery para {} orden(es) pendientes", failedOrders.size());
        for (Order order : failedOrders) {
            retryOrderDelivery(order);
        }
    }

    private void retryOrderDelivery(Order order) {
        int currentAttempts = order.getDeliveryRetryCount() == null ? 0 : order.getDeliveryRetryCount();
        if (currentAttempts >= maxAttempts) {
            abandonDelivery(order, "Maximo de reintentos alcanzado antes de reintentar");
            return;
        }

        try {
            orderWorkflowClient.createAndCompleteDelivery(order);
            order.setStatus(COMPLETED_STATUS);
            order.setDeliveryFailureReason(null);
            orderRepository.save(order);
            logger.info("Delivery reintentado y completado correctamente orderId={}", order.getId());
        } catch (BusinessRuleException | InventoryUnavailableException exception) {
            int attempts = currentAttempts + 1;
            order.setDeliveryRetryCount(attempts);
            order.setDeliveryLastRetryAt(LocalDateTime.now());
            order.setDeliveryFailureReason(exception.getMessage());

            if (attempts >= maxAttempts) {
                abandonDelivery(order, exception.getMessage());
                return;
            }

            order.setStatus(DELIVERY_RETRY_PENDING_STATUS);
            orderRepository.save(order);
            logger.warn("Delivery aun no disponible para reintento orderId={}, attempts={}/{}, reason={}",
                    order.getId(), attempts, maxAttempts, exception.getMessage());
        }
    }

    private void abandonDelivery(Order order, String reason) {
        order.setStatus(DELIVERY_ABANDONED_STATUS);
        order.setDeliveryLastRetryAt(LocalDateTime.now());
        order.setDeliveryFailureReason(reason);
        orderRepository.save(order);
        logger.error("Delivery abandonado definitivamente orderId={}, attempts={}, reason={}",
                order.getId(), order.getDeliveryRetryCount(), reason);
    }
}
