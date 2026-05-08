package com.fastorder.delivery.dto.response;

import com.fastorder.delivery.enums.DeliveryStatus;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DeliveryResponse {

    private Long id;
    private Long orderId;
    private DeliveryStatus status;
    private Long assignedDriverId;
    private String deliveryAddress;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime assignedAt;
    private LocalDateTime pickedUpAt;
    private LocalDateTime inTransitAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime failedAt;
    private LocalDateTime cancelledAt;
    private String cancelReason;
    private String failureReason;
    private List<DeliveryStatusHistoryResponse> history;
}
