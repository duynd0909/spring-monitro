package com.spring.monitro.actuator.collector;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.MonitorDataCollector;
import com.spring.monitro.core.model.HealthData;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.CompositeHealth;
import org.springframework.boot.actuate.health.Health;

import java.util.LinkedHashMap;
import java.util.Map;

public class HealthCollector implements MonitorDataCollector<HealthData> {

    public static final String ID = "health";

    private final HealthEndpoint healthEndpoint;

    public HealthCollector(HealthEndpoint healthEndpoint) {
        this.healthEndpoint = healthEndpoint;
    }

    @Override
    public String getId() { return ID; }

    @Override
    public CollectionResult<HealthData> collect() {
        HealthComponent root = healthEndpoint.health();
        String status = root.getStatus().getCode();
        Map<String, HealthData.ComponentHealth> components = new LinkedHashMap<>();

        if (root instanceof CompositeHealth composite) {
            composite.getComponents().forEach((name, component) ->
                    components.put(name, toComponentHealth(component)));
        }

        return CollectionResult.success(new HealthData(status, components));
    }

    private HealthData.ComponentHealth toComponentHealth(HealthComponent component) {
        String status = component.getStatus().getCode();
        Map<String, Object> details = new LinkedHashMap<>();
        if (component instanceof Health health) {
            details.putAll(health.getDetails());
        }
        return new HealthData.ComponentHealth(status, details);
    }
}
