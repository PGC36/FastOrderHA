package com.fastorder.menu.repository;

import com.fastorder.menu.entity.Producto;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    List<Producto> findByActivoTrueOrderByNombreAsc();

    List<Producto> findByDisponibleTrueAndActivoTrueOrderByNombreAsc();

    List<Producto> findByCategoriaIgnoreCaseAndActivoTrueOrderByNombreAsc(String categoria);
}
