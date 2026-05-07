package com.fastorder.orderservice.exception;

public class DuplicateOrderException extends BusinessRuleException {

    public DuplicateOrderException(String message) {
        super(message);
    }
}
