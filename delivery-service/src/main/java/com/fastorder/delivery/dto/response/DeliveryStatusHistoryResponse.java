package com.fastorder.delivery.dto.response;

import com.fastorder.delivery.enums.DeliveryStatus;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DeliveryStatusHistoryResponse {

    private Long id;
    private DeliveryStatus previousStatus;
    private DeliveryStatus newStatus;
    private String reason;
    private String changedBy;
    private LocalDateTime changedAt;
}
