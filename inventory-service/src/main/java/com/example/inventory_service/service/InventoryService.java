package com.example.inventory_service.service;

import com.example.inventory_service.dto.StockUpdateRequest;
import com.example.inventory_service.exception.ProductNotFoundException;
import com.example.inventory_service.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private static final int INVENTORY_OPERATION_REJECTED = 0;
    private static final int INVENTORY_OPERATION_CONFIRMED = 1;
    private static final int INVENTORY_OPERATION_ALREADY_APPLIED = 2;
    private static final int INVENTORY_OPERATION_PRODUCT_NOT_FOUND = -1;

    private final InventoryRepository inventoryRepository;

    public enum ConfirmSaleResult {
        CONFIRMED,
        ALREADY_CONFIRMED,
        PENDING_RESERVATION,
        RECOVERED_WITHOUT_RESERVATION
    }

    public boolean checkStock(Long productId, Integer quantity) {
        return inventoryRepository.findByProductId(productId)
                .map(inv -> (inv.getQuantity() - inv.getReserved()) >= quantity)
                .orElse(false);
    }

    @Transactional
    public boolean reserveStock(StockUpdateRequest request) {
        int updatedRows = inventoryRepository.reserveIfAvailable(request.getProductId(), request.getQuantity());
        if (updatedRows == 1) {
            return true;
        }

        if (!inventoryRepository.existsByProductId(request.getProductId())) {
            throw new ProductNotFoundException("El producto solicitado no existe");
        }

        return false;
    }

    @Transactional
    public boolean reserveStockForOrder(Long orderId, StockUpdateRequest request) {
        int result = inventoryRepository.reserveStockForOrderOptimized(
                orderId,
                request.getProductId(),
                request.getQuantity());

        if (result == INVENTORY_OPERATION_CONFIRMED || result == INVENTORY_OPERATION_ALREADY_APPLIED) {
            return true;
        }

        if (result == INVENTORY_OPERATION_PRODUCT_NOT_FOUND) {
            throw new ProductNotFoundException("El producto solicitado no existe");
        }

        return result != INVENTORY_OPERATION_REJECTED;
    }

    @Transactional
    public void releaseStock(StockUpdateRequest request) {
        if (request.getOrderId() != null && inventoryRepository.deleteReservation(request.getOrderId()) == 0) {
            return;
        }

        int updatedRows = inventoryRepository.releaseReserved(request.getProductId(), request.getQuantity());
        if (updatedRows == 0) {
            throw new ProductNotFoundException("El producto solicitado no existe");
        }
    }

    @Transactional
    public ConfirmSaleResult confirmSale(Long orderId, StockUpdateRequest request) {
        int result = inventoryRepository.confirmSaleOptimized(
                orderId,
                request.getProductId(),
                request.getQuantity());

        if (result == INVENTORY_OPERATION_CONFIRMED) {
            return ConfirmSaleResult.CONFIRMED;
        }

        if (result == INVENTORY_OPERATION_ALREADY_APPLIED) {
            return ConfirmSaleResult.ALREADY_CONFIRMED;
        }

        if (result == INVENTORY_OPERATION_REJECTED) {
            return ConfirmSaleResult.PENDING_RESERVATION;
        }

        throw new ProductNotFoundException("No existe reserva suficiente para confirmar la venta");
    }

    @Transactional
    public ConfirmSaleResult recoverDeliveredSaleWithoutReservation(Long orderId, StockUpdateRequest request) {
        int result = inventoryRepository.confirmDeliveredSaleWithoutReservationOptimized(
                orderId,
                request.getProductId(),
                request.getQuantity());

        if (result == INVENTORY_OPERATION_CONFIRMED) {
            return ConfirmSaleResult.RECOVERED_WITHOUT_RESERVATION;
        }

        if (result == INVENTORY_OPERATION_ALREADY_APPLIED) {
            return ConfirmSaleResult.ALREADY_CONFIRMED;
        }

        if (result == INVENTORY_OPERATION_REJECTED) {
            return ConfirmSaleResult.PENDING_RESERVATION;
        }

        throw new ProductNotFoundException("No existe inventario suficiente para reconciliar la venta entregada");
    }
}
