package com.example.inventory_service.service;

import com.example.inventory_service.dto.StockUpdateRequest;
import com.example.inventory_service.repository.InventoryRepository;
import com.example.inventory_service.service.InventoryService.ConfirmSaleResult;
import com.example.inventory_service.repository.projection.CompletedReservationProjection;
import com.example.inventory_service.repository.projection.DeliveredOrderProjection;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InventoryReconciliationService {

    private static final Logger logger = LoggerFactory.getLogger(InventoryReconciliationService.class);

    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;

    @Scheduled(fixedDelayString = "${app.inventory.reconciliation-delay-ms:5000}",
            initialDelayString = "${app.inventory.reconciliation-initial-delay-ms:10000}")
    public void reconcileCompletedSales() {
        var pendingReservations = inventoryRepository.findCompletedReservationsWithoutSale(50);
        for (CompletedReservationProjection reservation : pendingReservations) {
            reconcileCompletedSale(reservation);
        }

        var terminalReservations = inventoryRepository.findTerminalReservationsToRelease(50);
        for (CompletedReservationProjection reservation : terminalReservations) {
            reconcileTerminalReservation(reservation);
        }

        var deliveredOrders = inventoryRepository.findDeliveredOrdersWithoutSale(50);
        for (DeliveredOrderProjection deliveredOrder : deliveredOrders) {
            reconcileDeliveredOrderWithoutSale(deliveredOrder);
        }

        int repairedProducts = inventoryRepository.reconcileReservedCounters();
        if (repairedProducts > 0) {
            logger.warn("Contadores de reservas reconciliados automaticamente para {} producto(s)", repairedProducts);
        }
    }

    private void reconcileCompletedSale(CompletedReservationProjection reservation) {
        StockUpdateRequest request = new StockUpdateRequest();
        request.setOrderId(reservation.getOrderId());
        request.setProductId(reservation.getProductId());
        request.setQuantity(reservation.getQuantity());

        ConfirmSaleResult confirmSaleResult = inventoryService.confirmSale(reservation.getOrderId(), request);
        if (confirmSaleResult == ConfirmSaleResult.CONFIRMED) {
            logger.info("Venta reconciliada automaticamente orderId={}, productId={}, quantity={}",
                    reservation.getOrderId(), reservation.getProductId(), reservation.getQuantity());
            return;
        }

        if (confirmSaleResult == ConfirmSaleResult.PENDING_RESERVATION) {
            logger.warn("La reconciliacion encontro orden completada sin reserva lista orderId={}, productId={}, quantity={}",
                    reservation.getOrderId(), reservation.getProductId(), reservation.getQuantity());
        }
    }

    private void reconcileTerminalReservation(CompletedReservationProjection reservation) {
        StockUpdateRequest request = new StockUpdateRequest();
        request.setOrderId(reservation.getOrderId());
        request.setProductId(reservation.getProductId());
        request.setQuantity(reservation.getQuantity());

        inventoryService.releaseStock(request);
        logger.info("Reserva liberada automaticamente para orden terminal orderId={}, productId={}, quantity={}",
                reservation.getOrderId(), reservation.getProductId(), reservation.getQuantity());
    }

    private void reconcileDeliveredOrderWithoutSale(DeliveredOrderProjection deliveredOrder) {
        StockUpdateRequest request = new StockUpdateRequest();
        request.setOrderId(deliveredOrder.getOrderId());
        request.setProductId(deliveredOrder.getProductId());
        request.setQuantity(deliveredOrder.getQuantity());

        ConfirmSaleResult result = Boolean.TRUE.equals(deliveredOrder.getHasReservation())
                ? inventoryService.confirmSale(deliveredOrder.getOrderId(), request)
                : inventoryService.recoverDeliveredSaleWithoutReservation(deliveredOrder.getOrderId(), request);

        if (result == ConfirmSaleResult.CONFIRMED
                || result == ConfirmSaleResult.RECOVERED_WITHOUT_RESERVATION
                || result == ConfirmSaleResult.ALREADY_CONFIRMED) {
            logger.warn("Venta reconciliada desde delivery entregado orderId={}, productId={}, quantity={}, hasReservation={}, result={}",
                    deliveredOrder.getOrderId(),
                    deliveredOrder.getProductId(),
                    deliveredOrder.getQuantity(),
                    deliveredOrder.getHasReservation(),
                    result);
            return;
        }

        logger.warn("No se pudo reconciliar delivery entregado orderId={}, productId={}, quantity={}, hasReservation={}, result={}",
                deliveredOrder.getOrderId(),
                deliveredOrder.getProductId(),
                deliveredOrder.getQuantity(),
                deliveredOrder.getHasReservation(),
                result);
    }
}
