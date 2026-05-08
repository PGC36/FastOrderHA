package com.fastorder.delivery.exception;

public class DeliveryAlreadyExistsException extends RuntimeException {

    public DeliveryAlreadyExistsException(String message) {
        super(message);
    }
}
