package com.example.inventory_service.repository;

import com.example.inventory_service.entity.Inventory;
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
