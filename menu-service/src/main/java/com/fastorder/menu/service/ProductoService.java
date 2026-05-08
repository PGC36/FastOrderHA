package com.fastorder.menu.service;

import com.fastorder.menu.dto.ProductoRequestDTO;
import com.fastorder.menu.dto.ProductoResponseDTO;
import com.fastorder.menu.entity.Producto;
import com.fastorder.menu.exception.BadRequestException;
import com.fastorder.menu.exception.ResourceNotFoundException;
import com.fastorder.menu.repository.ProductoRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductoService {

    private static final Logger logger = LoggerFactory.getLogger(ProductoService.class);

    private final ProductoRepository productoRepository;

    public ProductoService(ProductoRepository productoRepository) {
        this.productoRepository = productoRepository;
    }

    @Transactional(readOnly = true)
    public List<ProductoResponseDTO> obtenerTodos() {
        logger.info("Consultando todos los productos activos del menu");
        return productoRepository.findByActivoTrueOrderByNombreAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProductoResponseDTO> obtenerDisponibles() {
        logger.info("Consultando productos disponibles y activos del menu");
        return productoRepository.findByDisponibleTrueAndActivoTrueOrderByNombreAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductoResponseDTO obtenerPorId(Long id) {
        logger.info("Consultando producto por id={}", id);
        return toResponse(buscarProductoActivo(id));
    }

    @Transactional(readOnly = true)
    public List<ProductoResponseDTO> obtenerPorCategoria(String categoria) {
        if (categoria == null || categoria.isBlank()) {
            logger.warn("Solicitud de productos por categoria vacia");
            throw new BadRequestException("La categoria es obligatoria para filtrar productos");
        }

        logger.info("Consultando productos activos por categoria={}", categoria);
        return productoRepository.findByCategoriaIgnoreCaseAndActivoTrueOrderByNombreAsc(categoria.trim()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ProductoResponseDTO crear(ProductoRequestDTO request) {
        logger.info("Creando producto nombre={} categoria={}", request.getNombre(), request.getCategoria());
        Producto producto = new Producto();
        aplicarRequest(producto, request, true);
        Producto guardado = productoRepository.save(producto);
        logger.info("Producto creado id={}", guardado.getId());
        return toResponse(guardado);
    }

    @Transactional
    public ProductoResponseDTO actualizar(Long id, ProductoRequestDTO request) {
        logger.info("Actualizando producto id={}", id);
        Producto producto = buscarProductoActivo(id);
        aplicarRequest(producto, request, false);
        Producto actualizado = productoRepository.save(producto);
        logger.info("Producto actualizado id={}", actualizado.getId());
        return toResponse(actualizado);
    }

    @Transactional
    public ProductoResponseDTO cambiarDisponibilidad(Long id, Boolean disponible) {
        if (disponible == null) {
            logger.warn("Solicitud de cambio de disponibilidad sin valor para producto id={}", id);
            throw new BadRequestException("El campo disponible es obligatorio y debe ser true o false");
        }

        logger.info("Cambiando disponibilidad del producto id={} a disponible={}", id, disponible);
        Producto producto = buscarProductoActivo(id);
        producto.setDisponible(disponible);
        Producto actualizado = productoRepository.save(producto);
        logger.info("Disponibilidad actualizada para producto id={}", actualizado.getId());
        return toResponse(actualizado);
    }

    @Transactional
    public void desactivar(Long id) {
        logger.info("Desactivando producto id={}", id);
        Producto producto = buscarProductoActivo(id);
        producto.setActivo(false);
        producto.setDisponible(false);
        productoRepository.save(producto);
        logger.info("Producto desactivado id={}", id);
    }

    private Producto buscarProductoActivo(Long id) {
        return productoRepository.findById(id)
                .filter(producto -> Boolean.TRUE.equals(producto.getActivo()))
                .orElseThrow(() -> {
                    logger.warn("Producto no encontrado o inactivo id={}", id);
                    return new ResourceNotFoundException("Producto con id " + id + " no encontrado");
                });
    }

    private void aplicarRequest(Producto producto, ProductoRequestDTO request, boolean usarValoresPorDefecto) {
        producto.setNombre(request.getNombre().trim());
        producto.setDescripcion(request.getDescripcion() == null ? null : request.getDescripcion().trim());
        producto.setPrecio(request.getPrecio());
        producto.setCategoria(request.getCategoria().trim());
        if (request.getDisponible() != null || usarValoresPorDefecto) {
            producto.setDisponible(request.getDisponible() == null ? true : request.getDisponible());
        }
        if (request.getActivo() != null || usarValoresPorDefecto) {
            producto.setActivo(request.getActivo() == null ? true : request.getActivo());
        }
    }

    private ProductoResponseDTO toResponse(Producto producto) {
        ProductoResponseDTO response = new ProductoResponseDTO();
        response.setId(producto.getId());
        response.setNombre(producto.getNombre());
        response.setDescripcion(producto.getDescripcion());
        response.setPrecio(producto.getPrecio());
        response.setCategoria(producto.getCategoria());
        response.setDisponible(producto.getDisponible());
        response.setActivo(producto.getActivo());
        response.setCreatedAt(producto.getCreatedAt());
        response.setUpdatedAt(producto.getUpdatedAt());
        return response;
    }
}
