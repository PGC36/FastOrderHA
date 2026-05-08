package com.example.demo.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NotificationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(NotificationNotFoundException ex, HttpServletRequest request) {
        log.warn("Notification not found. path={}, message={}", request.getRequestURI(), ex.getMessage());
        return buildError(HttpStatus.NOT_FOUND, ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiErrorResponse> handleBadRequest(Exception ex, HttpServletRequest request) {
        String message = resolveBadRequestMessage(ex);
        log.warn("Bad request. path={}, message={}", request.getRequestURI(), message);
        return buildError(HttpStatus.BAD_REQUEST, message, request.getRequestURI());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unexpected error. path={}", request.getRequestURI(), ex);
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", request.getRequestURI());
    }

    private ResponseEntity<ApiErrorResponse> buildError(HttpStatus status, String message, String path) {
        ApiErrorResponse response = new ApiErrorResponse(
                LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                path
        );
        return ResponseEntity.status(status).body(response);
    }

    private String resolveBadRequestMessage(Exception ex) {
        if (ex instanceof MethodArgumentNotValidException manve
                && manve.getBindingResult().getFieldError() != null) {
            var fieldError = manve.getBindingResult().getFieldError();
            return fieldError.getField() + ": " + fieldError.getDefaultMessage();
        }
        if (ex instanceof ConstraintViolationException cve && !cve.getConstraintViolations().isEmpty()) {
            return cve.getConstraintViolations().iterator().next().getMessage();
        }
        return "Invalid request data";
    }
}
