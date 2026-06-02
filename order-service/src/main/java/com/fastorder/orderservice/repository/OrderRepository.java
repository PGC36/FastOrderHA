package com.fastorder.orderservice.repository;

import com.fastorder.orderservice.entity.Order;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    List<Order> findByStatus(String status);

    List<Order> findByStatusIn(List<String> statuses);

    List<Order> findTop100ByStatusOrderByCreatedAtAsc(String status);

    List<Order> findByStatusOrderByCreatedAtAsc(String status, Pageable pageable);

    @Query(value = """
            select o.*
              from orders o
             where o.status in ('READY_FOR_DELIVERY', 'IN_DELIVERY', 'DELIVERY_FAILED', 'DELIVERY_RETRY_PENDING', 'CANCELLED')
               and exists (
                    select 1
                      from inventory_sales s
                     where s.order_id = o.id
               )
             order by o.created_at
             limit :limit
            """, nativeQuery = true)
    List<Order> findOrdersWithConfirmedSalePendingCompletion(@Param("limit") int limit);
}
