package com.spring.monitro.core.collector;

public class CollectionError {

    private final String collectorId;
    private final String message;
    private final boolean unavailable;

    public CollectionError(String collectorId, String message) {
        this(collectorId, message, false);
    }

    private CollectionError(String collectorId, String message, boolean unavailable) {
        this.collectorId = collectorId;
        this.message = message;
        this.unavailable = unavailable;
    }

    public static CollectionError unavailable(String collectorId) {
        return new CollectionError(collectorId, "Actuator endpoint not available or not enabled", true);
    }

    public String getCollectorId() { return collectorId; }
    public String getMessage() { return message; }
    public boolean isUnavailable() { return unavailable; }
}
