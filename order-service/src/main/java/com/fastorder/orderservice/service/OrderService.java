package com.fastorder.orderservice.service;

import com.fastorder.orderservice.dto.CreateOrderRequest;
import com.fastorder.orderservice.dto.OrderCreationResult;
import com.fastorder.orderservice.dto.OrderResponse;
import com.fastorder.orderservice.dto.UpdateOrderStatusRequest;
import com.fastorder.orderservice.entity.Order;
import com.fastorder.orderservice.entity.OutboxEvent;
import com.fastorder.orderservice.exception.BusinessRuleException;
import com.fastorder.orderservice.exception.DuplicateOrderException;
import com.fastorder.orderservice.exception.InventoryUnavailableException;
import com.fastorder.orderservice.exception.OrderNotFoundException;
import com.fastorder.orderservice.exception.ProductNotFoundException;
import com.fastorder.orderservice.repository.OrderRepository;
import com.fastorder.orderservice.repository.OutboxEventRepository;
import java.util.List;
import java.util.Objects;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private static final String INITIAL_STATUS = "PENDING";
    private static final String PROCESSING_STATUS = "PROCESSING";
    private static final String CANCELLED_STATUS = "CANCELLED";
    private static final String READY_FOR_DELIVERY_STATUS = "READY_FOR_DELIVERY";
    private static final String DELIVERY_FAILED_STATUS = "DELIVERY_FAILED";
    private static final String DELIVERY_RETRY_PENDING_STATUS = "DELIVERY_RETRY_PENDING";
    private static final String DELIVERY_ABANDONED_STATUS = "DELIVERY_ABANDONED";
    private static final String IN_DELIVERY_STATUS = "IN_DELIVERY";
    private static final String DELIVERY_CANCELLED_STATUS = "DELIVERY_CANCELLED";
    private static final String COMPLETED_STATUS = "COMPLETED";
    private static final String DEFAULT_DELIVERY_ADDRESS = "Direccion pendiente";

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

    @Transactional
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

        if (COMPLETED_STATUS.equals(order.getStatus()) && !COMPLETED_STATUS.equals(request.getStatus())) {
            logger.warn("Cambio de estado ignorado para pedido ya completado orderId={}, requestedStatus={}",
                    id, request.getStatus());
            return OrderResponse.fromEntity(order);
        }

        order.setStatus(request.getStatus());
        if (COMPLETED_STATUS.equals(request.getStatus())) {
            order.setDeliveryFailureReason(null);
        }
        Order updated = orderRepository.save(order);
        logger.info("Estado de pedido actualizado orderId={}, status={}", id, request.getStatus());
        return OrderResponse.fromEntity(updated);
    }

    @Transactional
    private OrderCreationResult createNewOrder(CreateOrderRequest request) {
        Order order = new Order();
        order.setIdempotencyKey(request.getIdempotencyKey());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setStatus(INITIAL_STATUS);
        order.setDeliveryAddress(valueOrDefault(request.getDeliveryAddress(), DEFAULT_DELIVERY_ADDRESS));
        order.setDeliveryRetryCount(0);

        Order savedOrder = orderRepository.save(order);
        logger.info("Pedido registrado con estado inicial. id={}, status={}",
                savedOrder.getId(), savedOrder.getStatus());

        OutboxEvent outboxEvent = new OutboxEvent();
        outboxEvent.setAggregateType("ORDER");
        outboxEvent.setAggregateId(savedOrder.getId());
        outboxEvent.setEventType("order.created");
        outboxEvent.setPayload(buildOrderCreatedPayload(savedOrder));
        outboxEvent.setProcessed(false);

        outboxEventRepository.save(outboxEvent);
        logger.info("Evento order.created guardado en outbox para orderId={}", savedOrder.getId());

        return new OrderCreationResult(
                OrderResponse.fromEntity(savedOrder, "Orden recibida y encolada para procesamiento"),
                true);
    }

    @Transactional
    public List<Long> claimPendingOrders(int limit) {
        List<Order> pendingOrders = orderRepository.findByStatusOrderByCreatedAtAsc(
                INITIAL_STATUS, PageRequest.of(0, limit));
        pendingOrders.forEach(order -> order.setStatus(PROCESSING_STATUS));
        orderRepository.saveAll(pendingOrders);
        return pendingOrders.stream()
                .map(Order::getId)
                .toList();
    }

    public void processClaimedOrder(Long orderId) {
        Order savedOrder = orderRepository.findById(orderId).orElse(null);
        if (savedOrder == null || !PROCESSING_STATUS.equals(savedOrder.getStatus())) {
            return;
        }

        boolean inventoryReserved = false;

        try {
            orderWorkflowClient.reserveInventory(toCreateOrderRequest(savedOrder));
            inventoryReserved = true;
            orderWorkflowClient.createKitchenOrder(savedOrder);
            savedOrder.setStatus(READY_FOR_DELIVERY_STATUS);
            savedOrder = orderRepository.save(savedOrder);
        } catch (BusinessRuleException | InventoryUnavailableException exception) {
            cancelOrder(savedOrder, exception.getMessage());
            if (inventoryReserved) {
                orderWorkflowClient.releaseInventory(savedOrder);
            }
            return;
        } catch (ProductNotFoundException exception) {
            cancelOrder(savedOrder, exception.getMessage());
            return;
        }

        try {
            orderWorkflowClient.createNotification(savedOrder, toCreateOrderRequest(savedOrder));
            orderWorkflowClient.createAndCompleteDelivery(savedOrder);
            logger.info("Delivery disparado correctamente para orderId={}; esperando confirmacion final por evento", savedOrder.getId());
        } catch (BusinessRuleException | InventoryUnavailableException exception) {
            markDeliveryRetryPending(savedOrder, exception.getMessage());
        }
    }

    private void cancelOrder(Order order, String reason) {
        order.setStatus(CANCELLED_STATUS);
        orderRepository.save(order);
        logger.warn("Pedido cancelado orderId={}, reason={}", order.getId(), reason);
    }

    @Transactional
    public void cancelOrderById(Long orderId, String reason) {
        orderRepository.findById(orderId)
                .ifPresent(order -> {
                    if (COMPLETED_STATUS.equals(order.getStatus())) {
                        logger.warn("Cancelacion ignorada para pedido ya completado orderId={}, reason={}",
                                orderId, reason);
                        return;
                    }
                    cancelOrder(order, reason);
                });
    }

    @Transactional
    public void completeOrderById(Long orderId) {
        orderRepository.findById(orderId)
                .ifPresent(order -> {
                    if (COMPLETED_STATUS.equals(order.getStatus())) {
                        return;
                    }
                    order.setStatus(COMPLETED_STATUS);
                    order.setDeliveryFailureReason(null);
                    orderRepository.save(order);
                    logger.info("Pedido completado por evento orderId={}", orderId);
                });
    }

    @Transactional
    public void markDeliveryRetryPendingById(Long orderId, String reason) {
        orderRepository.findById(orderId)
                .ifPresent(order -> {
                    if (COMPLETED_STATUS.equals(order.getStatus())) {
                        logger.warn("Fallo de delivery ignorado para pedido ya completado orderId={}, reason={}",
                                orderId, reason);
                        return;
                    }
                    markDeliveryRetryPending(order, reason);
                });
    }

    private void markOrderStatus(Order order, String status, String reason) {
        order.setStatus(status);
        orderRepository.save(order);
        logger.warn("Pedido actualizado por compensacion orderId={}, status={}, reason={}",
                order.getId(), status, reason);
    }

    private void markDeliveryRetryPending(Order order, String reason) {
        order.setStatus(DELIVERY_RETRY_PENDING_STATUS);
        order.setDeliveryRetryCount(order.getDeliveryRetryCount() == null ? 1 : order.getDeliveryRetryCount() + 1);
        order.setDeliveryLastRetryAt(LocalDateTime.now());
        order.setDeliveryFailureReason(shortReason(reason));
        orderRepository.save(order);
        logger.warn("Pedido pendiente de reintento de delivery orderId={}, attempts={}, reason={}",
                order.getId(), order.getDeliveryRetryCount(), reason);
    }

    private String shortReason(String reason) {
        if (reason == null) {
            return null;
        }
        return reason.length() <= 255 ? reason : reason.substring(0, 255);
    }

    private String buildOrderCreatedPayload(Order order) {
        return String.format(
                "{\"orderId\":%d,\"productId\":%d,\"quantity\":%d,\"deliveryAddress\":\"%s\",\"status\":\"%s\"}",
                order.getId(),
                order.getProductId(),
                order.getQuantity(),
                escapeJson(order.getDeliveryAddress()),
                order.getStatus());
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private CreateOrderRequest toCreateOrderRequest(Order order) {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setProductId(order.getProductId());
        request.setQuantity(order.getQuantity());
        request.setIdempotencyKey(order.getIdempotencyKey());
        request.setDeliveryAddress(order.getDeliveryAddress());
        return request;
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
        if (PROCESSING_STATUS.equals(existingOrder.getStatus())) {
            return "Orden en procesamiento";
        }
        if (CANCELLED_STATUS.equals(existingOrder.getStatus())) {
            return "Orden cancelada anteriormente";
        }
        if (DELIVERY_RETRY_PENDING_STATUS.equals(existingOrder.getStatus())) {
            return "Orden pendiente de reintento de delivery";
        }
        if (IN_DELIVERY_STATUS.equals(existingOrder.getStatus())) {
            return "Orden en entrega";
        }
        if (DELIVERY_CANCELLED_STATUS.equals(existingOrder.getStatus())) {
            return "Orden cancelada en delivery";
        }
        if (DELIVERY_FAILED_STATUS.equals(existingOrder.getStatus())) {
            return "Orden pendiente de reintento de delivery";
        }
        if (DELIVERY_ABANDONED_STATUS.equals(existingOrder.getStatus())) {
            return "Orden no pudo entregarse despues de varios reintentos";
        }
        return "Orden ya recibida anteriormente";
    }

    private String valueOrDefault(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
