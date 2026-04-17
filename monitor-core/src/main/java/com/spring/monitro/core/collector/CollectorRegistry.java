package com.spring.monitro.core.collector;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Central registry of all data collectors. Populated at startup by
 * ActuatorCollectorRegistrar. Read-only after context refresh — HashMap is safe.
 */
public class CollectorRegistry {

    private final Map<String, MonitorDataCollector<?>> collectors = new HashMap<>();

    public void register(MonitorDataCollector<?> collector) {
        collectors.put(collector.getId(), collector);
    }

    @SuppressWarnings("unchecked")
    public <T> CollectionResult<T> collect(String id) {
        var collector = (MonitorDataCollector<T>) collectors.get(id);
        if (collector == null) {
            return CollectionResult.unavailable(id);
        }
        try {
            return collector.collect();
        } catch (Exception e) {
            return CollectionResult.failure(id, e);
        }
    }

    public boolean hasCollector(String id) {
        return collectors.containsKey(id);
    }

    public Set<String> availableCollectors() {
        return collectors.keySet();
    }
}
