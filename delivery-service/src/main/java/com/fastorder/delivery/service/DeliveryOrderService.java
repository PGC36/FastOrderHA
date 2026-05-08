package com.fastorder.delivery.service;

import com.fastorder.delivery.dto.request.AssignDriverRequest;
import com.fastorder.delivery.dto.request.CancelDeliveryRequest;
import com.fastorder.delivery.dto.request.CreateDeliveryRequest;
import com.fastorder.delivery.dto.request.FailDeliveryRequest;
import com.fastorder.delivery.dto.response.DeliveryResponse;
import com.fastorder.delivery.dto.response.DeliveryStatusHistoryResponse;
import com.fastorder.delivery.enums.DeliveryStatus;
import com.fastorder.delivery.exception.DeliveryConflictException;
import com.fastorder.delivery.exception.DeliveryNotFoundException;
import com.fastorder.delivery.exception.InvalidDeliveryStatusException;
import com.fastorder.delivery.model.DeliveryOrder;
import com.fastorder.delivery.model.DeliveryStatusHistory;
import com.fastorder.delivery.repository.DeliveryOrderRepository;
import com.fastorder.delivery.repository.DeliveryStatusHistoryRepository;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeliveryOrderService {

    private static final Map<DeliveryStatus, List<DeliveryStatus>> ALLOWED_TRANSITIONS = new EnumMap<>(DeliveryStatus.class);

    static {
        ALLOWED_TRANSITIONS.put(DeliveryStatus.PENDING, List.of(DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED));
        ALLOWED_TRANSITIONS.put(DeliveryStatus.ASSIGNED, List.of(DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED));
        ALLOWED_TRANSITIONS.put(DeliveryStatus.PICKED_UP, List.of(DeliveryStatus.IN_TRANSIT, DeliveryStatus.FAILED));
        ALLOWED_TRANSITIONS.put(DeliveryStatus.IN_TRANSIT, List.of(DeliveryStatus.DELIVERED, DeliveryStatus.FAILED));
        ALLOWED_TRANSITIONS.put(DeliveryStatus.DELIVERED, List.of());
        ALLOWED_TRANSITIONS.put(DeliveryStatus.FAILED, List.of());
        ALLOWED_TRANSITIONS.put(DeliveryStatus.CANCELLED, List.of());
    }

    private final DeliveryOrderRepository deliveryOrderRepository;
    private final DeliveryStatusHistoryRepository deliveryStatusHistoryRepository;
    private final OrderStatusClient orderStatusClient;

    @Transactional
    public DeliveryResponse createDelivery(CreateDeliveryRequest request) {
        return deliveryOrderRepository.findByOrderId(request.getOrderId())
                .map(existing -> handleExistingDelivery(existing, request))
                .orElseGet(() -> createNewDelivery(request));
    }

    @Transactional(readOnly = true)
    public DeliveryResponse getDeliveryById(Long id) {
        DeliveryOrder deliveryOrder = findDeliveryById(id);
        return toResponse(deliveryOrder);
    }

    @Transactional(readOnly = true)
    public DeliveryResponse getDeliveryByOrderId(Long orderId) {
        DeliveryOrder deliveryOrder = deliveryOrderRepository.findByOrderId(orderId)
                .orElseThrow(() -> new DeliveryNotFoundException("Delivery not found"));
        return toResponse(deliveryOrder);
    }

    @Transactional
    public DeliveryResponse assignDriver(Long id, AssignDriverRequest request) {
        DeliveryOrder deliveryOrder = findDeliveryById(id);
        validateStatusTransition(deliveryOrder.getStatus(), DeliveryStatus.ASSIGNED);

        deliveryOrder.setAssignedDriverId(request.getDriverId());
        deliveryOrder.setAssignedAt(LocalDateTime.now());

        return applyStatusChange(deliveryOrder, DeliveryStatus.ASSIGNED, null, "system");
    }

    @Transactional
    public DeliveryResponse markPickedUp(Long id) {
        DeliveryOrder deliveryOrder = findDeliveryById(id);
        validateStatusTransition(deliveryOrder.getStatus(), DeliveryStatus.PICKED_UP);
        deliveryOrder.setPickedUpAt(LocalDateTime.now());
        return applyStatusChange(deliveryOrder, DeliveryStatus.PICKED_UP, null, "system");
    }

    @Transactional
    public DeliveryResponse markInTransit(Long id) {
        DeliveryOrder deliveryOrder = findDeliveryById(id);
        validateStatusTransition(deliveryOrder.getStatus(), DeliveryStatus.IN_TRANSIT);
        deliveryOrder.setInTransitAt(LocalDateTime.now());
        return applyStatusChange(deliveryOrder, DeliveryStatus.IN_TRANSIT, null, "system");
    }

    @Transactional
    public DeliveryResponse markDelivered(Long id) {
        DeliveryOrder deliveryOrder = findDeliveryById(id);
        validateStatusTransition(deliveryOrder.getStatus(), DeliveryStatus.DELIVERED);
        deliveryOrder.setDeliveredAt(LocalDateTime.now());
        return applyStatusChange(deliveryOrder, DeliveryStatus.DELIVERED, null, "system");
    }

    @Transactional
    public DeliveryResponse markFailed(Long id, FailDeliveryRequest request) {
        DeliveryOrder deliveryOrder = findDeliveryById(id);
        validateStatusTransition(deliveryOrder.getStatus(), DeliveryStatus.FAILED);
        deliveryOrder.setFailedAt(LocalDateTime.now());
        deliveryOrder.setFailureReason(request.getReason());
        return applyStatusChange(deliveryOrder, DeliveryStatus.FAILED, request.getReason(), "system");
    }

    @Transactional
    public DeliveryResponse cancelDelivery(Long id, CancelDeliveryRequest request) {
        DeliveryOrder deliveryOrder = findDeliveryById(id);
        validateStatusTransition(deliveryOrder.getStatus(), DeliveryStatus.CANCELLED);
        deliveryOrder.setCancelledAt(LocalDateTime.now());
        deliveryOrder.setCancelReason(request.getReason());
        return applyStatusChange(deliveryOrder, DeliveryStatus.CANCELLED, request.getReason(), "system");
    }

    private DeliveryResponse handleExistingDelivery(DeliveryOrder existing, CreateDeliveryRequest request) {
        if (sameDeliveryData(existing, request)) {
            return toResponse(existing);
        }

        throw new DeliveryConflictException("Delivery already exists for orderId with different data");
    }

    private DeliveryResponse createNewDelivery(CreateDeliveryRequest request) {
        DeliveryOrder deliveryOrder = DeliveryOrder.builder()
                .orderId(request.getOrderId())
                .deliveryAddress(request.getDeliveryAddress())
                .status(DeliveryStatus.PENDING)
                .build();

        try {
            DeliveryOrder saved = deliveryOrderRepository.save(deliveryOrder);
            recordStatusHistory(saved, null, DeliveryStatus.PENDING, null, "system");
            return toResponse(saved);
        } catch (DataIntegrityViolationException ex) {
            DeliveryOrder existing = deliveryOrderRepository.findByOrderId(request.getOrderId())
                    .orElseThrow(() -> ex);

            if (sameDeliveryData(existing, request)) {
                return toResponse(existing);
            }

            throw new DeliveryConflictException("Delivery already exists for orderId with different data");
        }
    }

    private DeliveryResponse applyStatusChange(
            DeliveryOrder deliveryOrder,
            DeliveryStatus targetStatus,
            String reason,
            String changedBy
    ) {
        DeliveryStatus previousStatus = deliveryOrder.getStatus();
        deliveryOrder.setStatus(targetStatus);

        DeliveryOrder updated = deliveryOrderRepository.save(deliveryOrder);
        recordStatusHistory(updated, previousStatus, targetStatus, reason, changedBy);
        orderStatusClient.syncDeliveryStatus(updated.getOrderId(), updated.getStatus());
        return toResponse(updated);
    }

    public void validateStatusTransition(DeliveryStatus current, DeliveryStatus target) {
        if (!ALLOWED_TRANSITIONS.getOrDefault(current, List.of()).contains(target)) {
            throw new InvalidDeliveryStatusException(
                    "Invalid delivery status transition from " + current + " to " + target
            );
        }
    }

    private DeliveryOrder findDeliveryById(Long id) {
        return deliveryOrderRepository.findById(id)
                .orElseThrow(() -> new DeliveryNotFoundException("Delivery not found"));
    }

    private boolean sameDeliveryData(DeliveryOrder existing, CreateDeliveryRequest request) {
        return existing.getOrderId().equals(request.getOrderId())
                && existing.getDeliveryAddress().equals(request.getDeliveryAddress());
    }

    private void recordStatusHistory(
            DeliveryOrder deliveryOrder,
            DeliveryStatus previousStatus,
            DeliveryStatus newStatus,
            String reason,
            String changedBy
    ) {
        DeliveryStatusHistory history = DeliveryStatusHistory.builder()
                .deliveryOrder(deliveryOrder)
                .previousStatus(previousStatus)
                .newStatus(newStatus)
                .reason(reason)
                .changedBy(changedBy)
                .build();

        deliveryStatusHistoryRepository.save(history);
    }

    private DeliveryResponse toResponse(DeliveryOrder deliveryOrder) {
        List<DeliveryStatusHistoryResponse> history = deliveryStatusHistoryRepository
                .findByDeliveryOrderIdOrderByChangedAtAsc(deliveryOrder.getId())
                .stream()
                .map(item -> DeliveryStatusHistoryResponse.builder()
                        .id(item.getId())
                        .previousStatus(item.getPreviousStatus())
                        .newStatus(item.getNewStatus())
                        .reason(item.getReason())
                        .changedBy(item.getChangedBy())
                        .changedAt(item.getChangedAt())
                        .build())
                .toList();

        return DeliveryResponse.builder()
                .id(deliveryOrder.getId())
                .orderId(deliveryOrder.getOrderId())
                .status(deliveryOrder.getStatus())
                .assignedDriverId(deliveryOrder.getAssignedDriverId())
                .deliveryAddress(deliveryOrder.getDeliveryAddress())
                .createdAt(deliveryOrder.getCreatedAt())
                .updatedAt(deliveryOrder.getUpdatedAt())
                .assignedAt(deliveryOrder.getAssignedAt())
                .pickedUpAt(deliveryOrder.getPickedUpAt())
                .inTransitAt(deliveryOrder.getInTransitAt())
                .deliveredAt(deliveryOrder.getDeliveredAt())
                .failedAt(deliveryOrder.getFailedAt())
                .cancelledAt(deliveryOrder.getCancelledAt())
                .cancelReason(deliveryOrder.getCancelReason())
                .failureReason(deliveryOrder.getFailureReason())
                .history(history)
                .build();
    }
}
