package com.fastorder.orderservice.repository;

import com.fastorder.orderservice.entity.Order;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    List<Order> findByStatus(String status);

    List<Order> findByStatusIn(List<String> statuses);
}
