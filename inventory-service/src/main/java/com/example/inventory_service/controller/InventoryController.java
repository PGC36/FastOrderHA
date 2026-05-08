package com.example.inventory_service.controller;

import com.example.inventory_service.dto.StockUpdateRequest;
import com.example.inventory_service.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    // Endpoint para consultar stock (Ej: GET
    // /api/inventory/check?productId=1&quantity=2)
    @GetMapping("/check")
    public ResponseEntity<Boolean> checkStock(
            @RequestParam Long productId,
            @RequestParam Integer quantity) {

        boolean isAvailable = inventoryService.checkStock(productId, quantity);
        return ResponseEntity.ok(isAvailable);
    }

    // Endpoint para reservar stock (Ej: POST /api/inventory/reserve)
    @PostMapping("/reserve")
    public ResponseEntity<String> reserveStock(@RequestBody StockUpdateRequest request) {
        boolean reserved = inventoryService.reserveStock(request);

        if (reserved) {
            return ResponseEntity.ok("Stock reservado exitosamente");
        } else {
            // Regla crítica cumplida: Si no hay stock, rechazamos la petición
            return ResponseEntity.badRequest().body("No hay suficiente stock disponible");
        }
    }
}
