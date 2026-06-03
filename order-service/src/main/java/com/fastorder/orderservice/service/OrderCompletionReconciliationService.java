package com.fastorder.orderservice.service;

import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.repository.OrderRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderCompletionReconciliationService {

    private static final Logger logger = LoggerFactory.getLogger(OrderCompletionReconciliationService.class);

    private final OrderRepository orderRepository;
    private final int batchSize;

    public OrderCompletionReconciliationService(
            OrderRepository orderRepository,
            @Value("${app.order-completion-reconciliation.batch-size:200}") int batchSize) {
        this.orderRepository = orderRepository;
        this.batchSize = batchSize;
    }

    @Scheduled(
            fixedDelayString = "${app.order-completion-reconciliation.fixed-delay-ms:5000}",
            initialDelayString = "${app.order-completion-reconciliation.initial-delay-ms:10000}")
    @Transactional
    public void reconcileCompletedOrders() {
        List<Order> orders = orderRepository.findOrdersWithConfirmedSalePendingCompletion(batchSize);
        if (orders.isEmpty()) {
            return;
        }

        for (Order order : orders) {
            order.setStatus("COMPLETED");
            order.setDeliveryFailureReason(null);
        }

        orderRepository.saveAll(orders);
        logger.info("Reconciliacion de ordenes completadas aplicada a {} pedido(s)", orders.size());
    }
}
