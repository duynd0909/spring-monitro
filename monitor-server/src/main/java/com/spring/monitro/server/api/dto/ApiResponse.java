package com.spring.monitro.server.api.dto;

import java.time.Instant;

public class ApiResponse<T> {

    private final String status;
    private final T data;
    private final String message;
    private final Instant timestamp;

    private ApiResponse(String status, T data, String message) {
        this.status = status;
        this.data = data;
        this.message = message;
        this.timestamp = Instant.now();
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>("ok", data, null);
    }

    public static <T> ApiResponse<T> unavailable(String collectorId) {
        return new ApiResponse<>("unavailable", null,
                "Collector '" + collectorId + "' is not available — check that the Actuator endpoint is enabled");
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>("error", null, message);
    }

    public String getStatus() { return status; }
    public T getData() { return data; }
    public String getMessage() { return message; }
    public Instant getTimestamp() { return timestamp; }
}
