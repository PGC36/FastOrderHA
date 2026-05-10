package com.example.inventory_service.repository;

import com.example.inventory_service.entity.Inventory;
import com.example.inventory_service.repository.projection.CompletedReservationProjection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findByProductId(Long productId);

    boolean existsByProductId(Long productId);

    @Modifying
    @Query("""
            update Inventory inv
               set inv.reserved = inv.reserved + :quantity
             where inv.productId = :productId
               and (inv.quantity - inv.reserved) >= :quantity
            """)
    int reserveIfAvailable(@Param("productId") Long productId, @Param("quantity") Integer quantity);

    @Modifying
    @Query(value = """
            update inventory
               set reserved = greatest(reserved - :quantity, 0)
             where product_id = :productId
            """, nativeQuery = true)
    int releaseReserved(@Param("productId") Long productId, @Param("quantity") Integer quantity);

    @Modifying
    @Query(value = """
            insert into inventory_reservations (order_id, product_id, quantity)
            values (:orderId, :productId, :quantity)
            on conflict (order_id) do nothing
            """, nativeQuery = true)
    int registerReservationIfNew(
            @Param("orderId") Long orderId,
            @Param("productId") Long productId,
            @Param("quantity") Integer quantity);

    @Modifying
    @Query(value = "delete from inventory_reservations where order_id = :orderId", nativeQuery = true)
    int deleteReservation(@Param("orderId") Long orderId);

    @Query(value = "select exists(select 1 from inventory_sales where order_id = :orderId)", nativeQuery = true)
    boolean saleExists(@Param("orderId") Long orderId);

    @Query(value = "select exists(select 1 from inventory_reservations where order_id = :orderId)", nativeQuery = true)
    boolean reservationExists(@Param("orderId") Long orderId);

    @Query(value = """
            select r.order_id as orderId,
                   r.product_id as productId,
                   r.quantity as quantity
              from inventory_reservations r
              join orders o on o.id = r.order_id
             where o.status = 'COMPLETED'
               and not exists (
                    select 1
                      from inventory_sales s
                     where s.order_id = r.order_id
               )
             order by r.created_at
             limit :limit
            """, nativeQuery = true)
    List<CompletedReservationProjection> findCompletedReservationsWithoutSale(@Param("limit") int limit);

    @Query(value = """
            select r.order_id as orderId,
                   r.product_id as productId,
                   r.quantity as quantity
              from inventory_reservations r
              join orders o on o.id = r.order_id
             where o.status in ('CANCELLED', 'DELIVERY_ABANDONED')
             order by r.created_at
             limit :limit
            """, nativeQuery = true)
    List<CompletedReservationProjection> findTerminalReservationsToRelease(@Param("limit") int limit);

    @Modifying
    @Query(value = """
            insert into inventory_sales (order_id, product_id, quantity)
            values (:orderId, :productId, :quantity)
            on conflict (order_id) do nothing
            """, nativeQuery = true)
    int registerSaleIfNew(
            @Param("orderId") Long orderId,
            @Param("productId") Long productId,
            @Param("quantity") Integer quantity);

    @Modifying
    @Query(value = """
            update inventory
               set quantity = quantity - :quantity,
                   reserved = reserved - :quantity,
                   sold = sold + :quantity
             where product_id = :productId
               and reserved >= :quantity
               and quantity >= :quantity
            """, nativeQuery = true)
    int consumeReserved(
            @Param("productId") Long productId,
            @Param("quantity") Integer quantity);
}
