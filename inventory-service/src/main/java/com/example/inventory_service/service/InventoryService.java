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

    private final InventoryRepository inventoryRepository;

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
    public void releaseStock(StockUpdateRequest request) {
        int updatedRows = inventoryRepository.releaseReserved(request.getProductId(), request.getQuantity());
        if (updatedRows == 0) {
            throw new ProductNotFoundException("El producto solicitado no existe");
        }
    }

    @Transactional
    public boolean confirmSale(Long orderId, StockUpdateRequest request) {
        int insertedRows = inventoryRepository.registerSaleIfNew(
                orderId,
                request.getProductId(),
                request.getQuantity());
        if (insertedRows == 0) {
            return false;
        }

        int updatedRows = inventoryRepository.consumeReserved(request.getProductId(), request.getQuantity());
        if (updatedRows == 0) {
            throw new ProductNotFoundException("No existe reserva suficiente para confirmar la venta");
        }

        return true;
    }
}
