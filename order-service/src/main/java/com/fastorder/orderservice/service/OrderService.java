package com.fastorder.orderservice.service;

import com.fastorder.orderservice.dto.CreateOrderRequest;
import com.fastorder.orderservice.dto.OrderCreationResult;
import com.fastorder.orderservice.dto.OrderResponse;
import com.fastorder.orderservice.dto.UpdateOrderStatusRequest;
import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.entity.OutboxEvent;
import com.fastorder.orderservice.exception.DuplicateOrderException;
import com.fastorder.orderservice.exception.OrderNotFoundException;
import com.fastorder.orderservice.repository.OrderRepository;
import com.fastorder.orderservice.repository.OutboxEventRepository;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private static final String INITIAL_STATUS = "PENDING";
    private static final String COMPLETED_STATUS = "COMPLETED";

    private final OrderRepository orderRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final OrderWorkflowClient orderWorkflowClient;

    public OrderService(
            OrderRepository orderRepository,
            OutboxEventRepository outboxEventRepository,
            OrderWorkflowClient orderWorkflowClient) {
        this.orderRepository = orderRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.orderWorkflowClient = orderWorkflowClient;
    }

    public OrderCreationResult createOrder(CreateOrderRequest request) {
        logger.info("Inicio de creación de pedido");
        logger.info("idempotencyKey recibido={}", request.getIdempotencyKey());

        return orderRepository.findByIdempotencyKey(request.getIdempotencyKey())
                .map(existingOrder -> {
                    logger.info("Pedido ya existente detectado por idempotencia idempotencyKey={}",
                            request.getIdempotencyKey());
                    validateIdempotentRetry(existingOrder, request);
                    return new OrderCreationResult(
                            OrderResponse.fromEntity(existingOrder, idempotentMessage(existingOrder)),
                            false);
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

    @Transactional
    public OrderResponse updateOrderStatus(Long id, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException("Pedido no encontrado con id " + id));

        order.setStatus(request.getStatus());
        Order updated = orderRepository.save(order);
        logger.info("Estado de pedido actualizado orderId={}, status={}", id, request.getStatus());
        return OrderResponse.fromEntity(updated);
    }

    private OrderCreationResult createNewOrder(CreateOrderRequest request) {
        orderWorkflowClient.reserveInventory(request);

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

        orderWorkflowClient.createKitchenOrder(savedOrder);
        orderWorkflowClient.createDelivery(savedOrder, request);
        savedOrder.setStatus(COMPLETED_STATUS);
        savedOrder = orderRepository.save(savedOrder);
        orderWorkflowClient.createNotification(savedOrder, request);

        return new OrderCreationResult(
                OrderResponse.fromEntity(savedOrder, "Orden creada y entregada correctamente"),
                true);
    }

    private String buildOrderCreatedPayload(Order order) {
        return String.format(
                "{\"orderId\":%d,\"productId\":%d,\"quantity\":%d,\"status\":\"%s\"}",
                order.getId(),
                order.getProductId(),
                order.getQuantity(),
                order.getStatus());
    }

    private void validateIdempotentRetry(Order existingOrder, CreateOrderRequest request) {
        boolean sameRequest = Objects.equals(existingOrder.getProductId(), request.getProductId())
                && Objects.equals(existingOrder.getQuantity(), request.getQuantity());

        if (!sameRequest) {
            throw new DuplicateOrderException(
                    "idempotencyKey ya fue usada con datos diferentes");
        }
    }

    private String idempotentMessage(Order existingOrder) {
        if (COMPLETED_STATUS.equals(existingOrder.getStatus())) {
            return "Orden ya entregada anteriormente";
        }
        return "Orden ya recibida anteriormente";
    }
}
