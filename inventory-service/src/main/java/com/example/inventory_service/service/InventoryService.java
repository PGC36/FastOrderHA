package com.example.inventory_service.service;

import com.example.inventory_service.dto.StockUpdateRequest;
import com.example.inventory_service.entity.Inventory;
import com.example.inventory_service.exception.ProductNotFoundException;
import com.example.inventory_service.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    // Método para consultar si hay stock
    public boolean checkStock(Long productId, Integer quantity) {
        return inventoryRepository.findByProductId(productId)
                .map(inv -> (inv.getQuantity() - inv.getReserved()) >= quantity)
                .orElse(false);
    }

    // Método para reservar stock (cumple la regla crítica de no sobrevender)
    @Transactional
    public boolean reserveStock(StockUpdateRequest request) {
        Inventory inventory = inventoryRepository.findByProductId(request.getProductId())
                .orElseThrow(() -> new ProductNotFoundException("El producto solicitado no existe"));

        int stockDisponible = inventory.getQuantity() - inventory.getReserved();

        if (stockDisponible >= request.getQuantity()) {
            inventory.setReserved(inventory.getReserved() + request.getQuantity());
            inventoryRepository.save(inventory);
            return true;
        }
        return false;
    }

    @Transactional
    public void releaseStock(StockUpdateRequest request) {
        Inventory inventory = inventoryRepository.findByProductId(request.getProductId())
                .orElseThrow(() -> new ProductNotFoundException("El producto solicitado no existe"));

        int releasedQuantity = Math.min(inventory.getReserved(), request.getQuantity());
        inventory.setReserved(inventory.getReserved() - releasedQuantity);
        inventoryRepository.save(inventory);
    }
}
