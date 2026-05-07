package com.fastorder.orderservice.service;

import com.fastorder.orderservice.dto.CreateOrderRequest;
import com.fastorder.orderservice.dto.OrderResponse;
import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.entity.OutboxEvent;
import com.fastorder.orderservice.exception.OrderNotFoundException;
import com.fastorder.orderservice.repository.OrderRepository;
import com.fastorder.orderservice.repository.OutboxEventRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private static final String INITIAL_STATUS = "PENDING";

    private final OrderRepository orderRepository;
    private final OutboxEventRepository outboxEventRepository;

    public OrderService(OrderRepository orderRepository, OutboxEventRepository outboxEventRepository) {
        this.orderRepository = orderRepository;
        this.outboxEventRepository = outboxEventRepository;
    }

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        logger.info("Inicio de creación de pedido");
        logger.info("idempotencyKey recibido={}", request.getIdempotencyKey());

        return orderRepository.findByIdempotencyKey(request.getIdempotencyKey())
                .map(existingOrder -> {
                    logger.info("Pedido ya existente detectado por idempotencia idempotencyKey={}",
                            request.getIdempotencyKey());
                    return OrderResponse.fromEntity(existingOrder);
                })
                .orElseGet(() -> createNewOrder(request));
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAll()
                .stream()
                .map(OrderResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException("Pedido no encontrado con id " + id));
        return OrderResponse.fromEntity(order);
    }

    private OrderResponse createNewOrder(CreateOrderRequest request) {
        validateInventoryReservation(request);

        Order order = new Order();
        order.setIdempotencyKey(request.getIdempotencyKey());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setStatus(INITIAL_STATUS);

        Order savedOrder = orderRepository.save(order);
        logger.info("Pedido creado correctamente con id={}", savedOrder.getId());

        OutboxEvent outboxEvent = new OutboxEvent();
        outboxEvent.setAggregateType("ORDER");
        outboxEvent.setAggregateId(savedOrder.getId());
        outboxEvent.setEventType("order.created");
        outboxEvent.setPayload(buildOrderCreatedPayload(savedOrder));
        outboxEvent.setProcessed(false);

        outboxEventRepository.save(outboxEvent);
        logger.info("Evento order.created guardado en outbox para orderId={}", savedOrder.getId());

        return OrderResponse.fromEntity(savedOrder);
    }

    private void validateInventoryReservation(CreateOrderRequest request) {
        // Preparado para integrar inventory-service en una siguiente fase.
        // Por ahora no se realiza llamada remota y el pedido queda en estado PENDING.
    }

    private String buildOrderCreatedPayload(Order order) {
        return String.format(
                "{\"orderId\":%d,\"productId\":%d,\"quantity\":%d,\"status\":\"%s\"}",
                order.getId(),
                order.getProductId(),
                order.getQuantity(),
                order.getStatus());
    }
}
