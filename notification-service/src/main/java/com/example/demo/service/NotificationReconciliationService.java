package com.example.demo.service;

import com.example.demo.dto.CreateNotificationRequest;
import com.example.demo.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationReconciliationService.class);
    private static final String DEFAULT_CHANNEL = "EMAIL";
    private static final String DEFAULT_RECIPIENT = "cliente@fastorder.test";

    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;

    @Scheduled(fixedDelayString = "${app.notifications.reconciliation-delay-ms:5000}",
            initialDelayString = "${app.notifications.reconciliation-initial-delay-ms:10000}")
    public void reconcileCompletedOrdersWithoutNotification() {
        try {
            var orderIds = notificationRepository.findCompletedOrdersWithoutNotification(50);
            for (Long orderId : orderIds) {
                if (notificationRepository.existsByOrderId(orderId)) {
                    continue;
                }

                notificationService.create(new CreateNotificationRequest(
                        orderId,
                        DEFAULT_CHANNEL,
                        DEFAULT_RECIPIENT,
                        "Pedido " + orderId + " entregado correctamente"
                ));
                log.info("Notificacion reconciliada automaticamente para orderId={}", orderId);
            }
        } catch (RuntimeException exception) {
            log.warn("Reconciliacion de notificaciones pospuesta: {}", exception.getMessage());
        }
    }
}
