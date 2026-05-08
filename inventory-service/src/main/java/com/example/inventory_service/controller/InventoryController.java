package com.example.inventory_service.controller;

import com.example.inventory_service.dto.StockUpdateRequest;
import com.example.inventory_service.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    // Endpoint para consultar stock.
    @GetMapping("/check")
    public ResponseEntity<Boolean> checkStock(
            @RequestParam Long productId,
            @RequestParam Integer quantity) {

        boolean isAvailable = inventoryService.checkStock(productId, quantity);
        return ResponseEntity.ok(isAvailable);
    }

    // Endpoint para reservar stock.
    @PostMapping("/reserve")
    public ResponseEntity<String> reserveStock(@RequestBody StockUpdateRequest request) {
        boolean reserved = inventoryService.reserveStock(request);

        if (reserved) {
            return ResponseEntity.ok("Stock reservado exitosamente");
        } else {
            // Si no hay stock, rechazamos la peticion.
            return ResponseEntity.badRequest().body("No hay suficiente stock disponible");
        }
    }
}
