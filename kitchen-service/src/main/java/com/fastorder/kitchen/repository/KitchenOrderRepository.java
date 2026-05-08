package com.fastorder.kitchen.repository;

import com.fastorder.kitchen.model.KitchenOrder;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KitchenOrderRepository extends JpaRepository<KitchenOrder, Long> {

    Optional<KitchenOrder> findByOrderId(Long orderId);

    boolean existsByOrderId(Long orderId);
}
