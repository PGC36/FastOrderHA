package com.fastorder.delivery.repository;

import com.fastorder.delivery.model.DeliveryStatusHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryStatusHistoryRepository extends JpaRepository<DeliveryStatusHistory, Long> {

    List<DeliveryStatusHistory> findByDeliveryOrderIdOrderByChangedAtAsc(Long deliveryOrderId);
}
