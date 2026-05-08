package com.fastorder.delivery.repository;

import com.fastorder.delivery.enums.DeliveryStatus;
import com.fastorder.delivery.model.DeliveryOrder;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryOrderRepository extends JpaRepository<DeliveryOrder, Long> {

    Optional<DeliveryOrder> findByOrderId(Long orderId);

    boolean existsByOrderId(Long orderId);

    List<DeliveryOrder> findByStatus(DeliveryStatus status);

    List<DeliveryOrder> findByAssignedDriverId(Long driverId);
}
