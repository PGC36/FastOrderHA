package com.fastorder.delivery.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AssignDriverRequest {

    @NotNull(message = "driverId is required")
    @Positive(message = "driverId must be positive")
    private Long driverId;
}
