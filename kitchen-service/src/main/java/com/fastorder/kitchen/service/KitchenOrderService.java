package com.fastorder.kitchen.service;

import com.fastorder.kitchen.dto.CreateKitchenOrderRequest;
import com.fastorder.kitchen.dto.KitchenOrderResponse;
import com.fastorder.kitchen.dto.UpdateKitchenStatusRequest;
import com.fastorder.kitchen.enums.KitchenOrderStatus;
import com.fastorder.kitchen.exception.ResourceNotFoundException;
import com.fastorder.kitchen.model.KitchenOrder;
import com.fastorder.kitchen.repository.KitchenOrderRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class KitchenOrderService {

    private final KitchenOrderRepository kitchenOrderRepository;
    private final OrderStatusClient orderStatusClient;

    @Transactional(readOnly = true)
    public List<KitchenOrderResponse> getAllOrders() {
        return kitchenOrderRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public KitchenOrderResponse getOrderById(Long id) {
        KitchenOrder kitchenOrder = kitchenOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kitchen order not found"));

        return toResponse(kitchenOrder);
    }

    @Transactional
    public KitchenOrderResponse createKitchenOrder(CreateKitchenOrderRequest request) {
        return kitchenOrderRepository.findByOrderId(request.getOrderId())
                .map(this::toResponse)
                .orElseGet(() -> {
                    KitchenOrder kitchenOrder = KitchenOrder.builder()
                            .orderId(request.getOrderId())
                            .status(KitchenOrderStatus.PENDING)
                            .build();

                    try {
                        KitchenOrder saved = kitchenOrderRepository.save(kitchenOrder);
                        return toResponse(saved);
                    } catch (DataIntegrityViolationException ex) {
                        return kitchenOrderRepository.findByOrderId(request.getOrderId())
                                .map(this::toResponse)
                                .orElseThrow(() -> ex);
                    }
                });
    }

    @Transactional
    public KitchenOrderResponse updateStatus(Long id, UpdateKitchenStatusRequest request) {
        KitchenOrder kitchenOrder = kitchenOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kitchen order not found"));

        KitchenOrderStatus status = request.getStatus();
        kitchenOrder.setStatus(status);

        if (status == KitchenOrderStatus.PREPARING && kitchenOrder.getStartedAt() == null) {
            kitchenOrder.setStartedAt(LocalDateTime.now());
        }

        if (status == KitchenOrderStatus.READY) {
            if (kitchenOrder.getStartedAt() == null) {
                kitchenOrder.setStartedAt(LocalDateTime.now());
            }
            kitchenOrder.setReadyAt(LocalDateTime.now());
        }

        if (status == KitchenOrderStatus.CANCELLED) {
            kitchenOrder.setReadyAt(null);
        }

        KitchenOrder updated = kitchenOrderRepository.save(kitchenOrder);
        orderStatusClient.syncKitchenStatus(updated.getOrderId(), updated.getStatus());
        return toResponse(updated);
    }

    private KitchenOrderResponse toResponse(KitchenOrder kitchenOrder) {
        return KitchenOrderResponse.builder()
                .id(kitchenOrder.getId())
                .orderId(kitchenOrder.getOrderId())
                .status(kitchenOrder.getStatus())
                .createdAt(kitchenOrder.getCreatedAt())
                .updatedAt(kitchenOrder.getUpdatedAt())
                .startedAt(kitchenOrder.getStartedAt())
                .readyAt(kitchenOrder.getReadyAt())
                .build();
    }
}
