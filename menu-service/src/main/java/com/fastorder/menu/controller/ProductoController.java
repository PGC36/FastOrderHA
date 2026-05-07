package com.fastorder.menu.controller;

import com.fastorder.menu.dto.ProductoRequestDTO;
import com.fastorder.menu.dto.ProductoResponseDTO;
import com.fastorder.menu.service.ProductoService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/menu/productos")
public class ProductoController {

    private static final Logger logger = LoggerFactory.getLogger(ProductoController.class);

    private final ProductoService productoService;

    public ProductoController(ProductoService productoService) {
        this.productoService = productoService;
    }

    @GetMapping
    public ResponseEntity<List<ProductoResponseDTO>> obtenerTodos() {
        logger.info("GET /api/menu/productos");
        return ResponseEntity.ok(productoService.obtenerTodos());
    }

    @GetMapping("/disponibles")
    public ResponseEntity<List<ProductoResponseDTO>> obtenerDisponibles() {
        logger.info("GET /api/menu/productos/disponibles");
        return ResponseEntity.ok(productoService.obtenerDisponibles());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductoResponseDTO> obtenerPorId(@PathVariable Long id) {
        logger.info("GET /api/menu/productos/{}", id);
        return ResponseEntity.ok(productoService.obtenerPorId(id));
    }

    @GetMapping("/categoria/{categoria}")
    public ResponseEntity<List<ProductoResponseDTO>> obtenerPorCategoria(@PathVariable String categoria) {
        logger.info("GET /api/menu/productos/categoria/{}", categoria);
        return ResponseEntity.ok(productoService.obtenerPorCategoria(categoria));
    }

    @PostMapping
    public ResponseEntity<ProductoResponseDTO> crear(@Valid @RequestBody ProductoRequestDTO request) {
        logger.info("POST /api/menu/productos");
        ProductoResponseDTO producto = productoService.crear(request);
        return ResponseEntity
                .created(URI.create("/api/menu/productos/" + producto.getId()))
                .body(producto);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductoResponseDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ProductoRequestDTO request) {
        logger.info("PUT /api/menu/productos/{}", id);
        return ResponseEntity.ok(productoService.actualizar(id, request));
    }

    @PatchMapping("/{id}/disponibilidad")
    public ResponseEntity<ProductoResponseDTO> cambiarDisponibilidad(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> request) {
        logger.info("PATCH /api/menu/productos/{}/disponibilidad", id);
        return ResponseEntity.ok(productoService.cambiarDisponibilidad(id, request.get("disponible")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        logger.info("DELETE /api/menu/productos/{}", id);
        productoService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
