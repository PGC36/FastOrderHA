package com.example.demo.repository;

import com.example.demo.entity.Notification;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Optional<Notification> findByOrderId(Long orderId);

    boolean existsByOrderId(Long orderId);

    @Query(value = """
            select o.id
            from orders o
            where o.status = 'COMPLETED'
              and not exists (
                  select 1
                  from notifications n
                  where n.order_id = o.id
              )
            order by o.id
            limit :limit
            """, nativeQuery = true)
    List<Long> findCompletedOrdersWithoutNotification(@Param("limit") int limit);
}
