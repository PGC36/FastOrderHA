package com.fastorder.delivery.exception;

public class InvalidDeliveryStatusException extends RuntimeException {

    public InvalidDeliveryStatusException(String message) {
        super(message);
    }
}
