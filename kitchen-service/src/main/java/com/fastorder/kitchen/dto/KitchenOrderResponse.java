package com.fastorder.kitchen.dto;

import com.fastorder.kitchen.enums.KitchenOrderStatus;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class KitchenOrderResponse {

    private Long id;
    private Long orderId;
    private KitchenOrderStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime startedAt;
    private LocalDateTime readyAt;
}
