package com.fastorder.orderservice.service;

import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.repository.OrderRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class OrderInventoryRejectionReconciliationService {

    private static final Logger logger = LoggerFactory.getLogger(OrderInventoryRejectionReconciliationService.class);

    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final int batchSize;

    public OrderInventoryRejectionReconciliationService(
            OrderRepository orderRepository,
            OrderService orderService,
            @Value("${app.order-inventory-rejection-reconciliation.batch-size:20}") int batchSize) {
        this.orderRepository = orderRepository;
        this.orderService = orderService;
        this.batchSize = batchSize;
    }

    @Scheduled(
            fixedDelayString = "${app.order-inventory-rejection-reconciliation.fixed-delay-ms:5000}",
            initialDelayString = "${app.order-inventory-rejection-reconciliation.initial-delay-ms:15000}")
    public void reconcileCancelledOrders() {
        List<Order> orders = orderRepository.findRecoverableInventoryRejectedOrders(batchSize);
        if (orders.isEmpty()) {
            return;
        }

        int reopened = 0;
        for (Order order : orders) {
            if (!orderService.reopenCancelledOrderForInventoryRetry(order.getId())) {
                continue;
            }
            reopened++;
            orderService.processClaimedOrder(order.getId());
        }

        if (reopened > 0) {
            logger.info("Reconciliacion de rechazos de inventario reaplico {} pedido(s)", reopened);
        }
    }
}
