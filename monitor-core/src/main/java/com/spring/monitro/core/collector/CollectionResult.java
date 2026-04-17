package com.spring.monitro.core.collector;

public class CollectionResult<T> {

    private final T data;
    private final CollectionError error;

    private CollectionResult(T data, CollectionError error) {
        this.data = data;
        this.error = error;
    }

    public static <T> CollectionResult<T> success(T data) {
        return new CollectionResult<>(data, null);
    }

    public static <T> CollectionResult<T> failure(String collectorId, Exception cause) {
        return new CollectionResult<>(null, new CollectionError(collectorId, cause.getMessage()));
    }

    public static <T> CollectionResult<T> unavailable(String collectorId) {
        return new CollectionResult<>(null, CollectionError.unavailable(collectorId));
    }

    public boolean isSuccess() { return error == null; }
    public T getData() { return data; }
    public CollectionError getError() { return error; }
}
