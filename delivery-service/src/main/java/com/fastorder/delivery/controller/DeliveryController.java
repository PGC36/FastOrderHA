package com.fastorder.delivery.controller;

import com.fastorder.delivery.dto.request.AssignDriverRequest;
import com.fastorder.delivery.dto.request.CancelDeliveryRequest;
import com.fastorder.delivery.dto.request.CreateDeliveryRequest;
import com.fastorder.delivery.dto.request.FailDeliveryRequest;
import com.fastorder.delivery.dto.response.DeliveryResponse;
import com.fastorder.delivery.service.DeliveryOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/deliveries")
@RequiredArgsConstructor
public class DeliveryController {

    private final DeliveryOrderService deliveryOrderService;

    @PostMapping
    public DeliveryResponse createDelivery(@Valid @RequestBody CreateDeliveryRequest request) {
        return deliveryOrderService.createDelivery(request);
    }

    @GetMapping("/{id}")
    public DeliveryResponse getDeliveryById(@PathVariable Long id) {
        return deliveryOrderService.getDeliveryById(id);
    }

    @GetMapping("/by-order/{orderId}")
    public DeliveryResponse getDeliveryByOrderId(@PathVariable Long orderId) {
        return deliveryOrderService.getDeliveryByOrderId(orderId);
    }

    @PatchMapping("/{id}/assign")
    public DeliveryResponse assignDriver(@PathVariable Long id, @Valid @RequestBody AssignDriverRequest request) {
        return deliveryOrderService.assignDriver(id, request);
    }

    @PatchMapping("/{id}/pick-up")
    public DeliveryResponse markPickedUp(@PathVariable Long id) {
        return deliveryOrderService.markPickedUp(id);
    }

    @PatchMapping("/{id}/in-transit")
    public DeliveryResponse markInTransit(@PathVariable Long id) {
        return deliveryOrderService.markInTransit(id);
    }

    @PatchMapping("/{id}/deliver")
    public DeliveryResponse markDelivered(@PathVariable Long id) {
        return deliveryOrderService.markDelivered(id);
    }

    @PatchMapping("/{id}/fail")
    public DeliveryResponse markFailed(@PathVariable Long id, @Valid @RequestBody FailDeliveryRequest request) {
        return deliveryOrderService.markFailed(id, request);
    }

    @PatchMapping("/{id}/cancel")
    public DeliveryResponse cancelDelivery(@PathVariable Long id, @Valid @RequestBody CancelDeliveryRequest request) {
        return deliveryOrderService.cancelDelivery(id, request);
    }
}
