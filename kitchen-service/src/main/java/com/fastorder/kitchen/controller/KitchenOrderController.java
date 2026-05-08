package com.fastorder.kitchen.controller;

import com.fastorder.kitchen.dto.CreateKitchenOrderRequest;
import com.fastorder.kitchen.dto.KitchenOrderResponse;
import com.fastorder.kitchen.dto.UpdateKitchenStatusRequest;
import com.fastorder.kitchen.service.KitchenOrderService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/kitchen/orders")
@RequiredArgsConstructor
public class KitchenOrderController {

    private final KitchenOrderService kitchenOrderService;

    @GetMapping
    public List<KitchenOrderResponse> getAllOrders() {
        return kitchenOrderService.getAllOrders();
    }

    @GetMapping("/{id}")
    public KitchenOrderResponse getOrderById(@PathVariable Long id) {
        return kitchenOrderService.getOrderById(id);
    }

    @PostMapping
    public KitchenOrderResponse createKitchenOrder(@Valid @RequestBody CreateKitchenOrderRequest request) {
        return kitchenOrderService.createKitchenOrder(request);
    }

    @PatchMapping("/{id}/status")
    public KitchenOrderResponse updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateKitchenStatusRequest request
    ) {
        return kitchenOrderService.updateStatus(id, request);
    }
}
