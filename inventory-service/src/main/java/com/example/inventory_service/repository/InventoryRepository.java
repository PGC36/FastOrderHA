package com.example.inventory_service.repository;

import com.example.inventory_service.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    // Spring Data JPA es mágico: solo con nombrar así el método,
    // él hace el "SELECT * FROM inventory WHERE product_id = ?"
    Optional<Inventory> findByProductId(Long productId);
}
