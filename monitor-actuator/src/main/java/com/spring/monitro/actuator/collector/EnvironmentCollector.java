package com.spring.monitro.actuator.collector;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.MonitorDataCollector;
import com.spring.monitro.core.model.EnvironmentData;
import org.springframework.boot.actuate.env.EnvironmentEndpoint;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class EnvironmentCollector implements MonitorDataCollector<EnvironmentData> {

    public static final String ID = "environment";

    private final EnvironmentEndpoint environmentEndpoint;

    public EnvironmentCollector(EnvironmentEndpoint environmentEndpoint) {
        this.environmentEndpoint = environmentEndpoint;
    }

    @Override
    public String getId() { return ID; }

    @Override
    public CollectionResult<EnvironmentData> collect() {
        EnvironmentEndpoint.EnvironmentDescriptor descriptor = environmentEndpoint.environment(null);

        List<EnvironmentData.PropertySource> sources = descriptor.getPropertySources().stream()
                .map(ps -> {
                    Map<String, Object> props = new LinkedHashMap<>();
                    ps.getProperties().forEach((key, value) ->
                            props.put(key, value.getValue()));
                    return new EnvironmentData.PropertySource(ps.getName(), props);
                })
                .toList();

        return CollectionResult.success(new EnvironmentData(sources));
    }
}
