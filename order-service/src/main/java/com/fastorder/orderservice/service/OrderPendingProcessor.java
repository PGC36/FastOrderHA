package com.fastorder.orderservice.service;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Component
public class OrderPendingProcessor {

    private static final Logger logger = LoggerFactory.getLogger(OrderPendingProcessor.class);

    private final OrderService orderService;
    private final ThreadPoolTaskExecutor orderWorkflowExecutor;
    private final int batchSize;

    public OrderPendingProcessor(
            OrderService orderService,
            @Qualifier("orderWorkflowExecutor") ThreadPoolTaskExecutor orderWorkflowExecutor,
            @Value("${app.orders.pending-processor-batch-size:200}") int batchSize) {
        this.orderService = orderService;
        this.orderWorkflowExecutor = orderWorkflowExecutor;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${app.orders.pending-processor-delay-ms:250}")
    public void processPendingOrders() {
        int capacity = availableWorkerCapacity();
        if (capacity <= 0) {
            return;
        }

        List<Long> orderIds = orderService.claimPendingOrders(Math.min(batchSize, capacity));
        for (Long orderId : orderIds) {
            orderWorkflowExecutor.execute(() -> orderService.processClaimedOrder(orderId));
        }

        if (!orderIds.isEmpty()) {
            logger.info("Lote de pedidos pendientes reclamado para procesamiento count={}, activeWorkers={}",
                    orderIds.size(), orderWorkflowExecutor.getActiveCount());
        }
    }

    private int availableWorkerCapacity() {
        int queueSize = orderWorkflowExecutor.getThreadPoolExecutor().getQueue().size();
        int maxInFlight = orderWorkflowExecutor.getMaxPoolSize() * 4;
        return Math.max(0, maxInFlight - orderWorkflowExecutor.getActiveCount() - queueSize);
    }
}
