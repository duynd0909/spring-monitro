package com.spring.monitro.actuator.collector;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.MonitorDataCollector;
import com.spring.monitro.core.model.MetricData;
import org.springframework.boot.actuate.metrics.MetricsEndpoint;

import java.util.List;
import java.util.Map;

public class MetricsCollector implements MonitorDataCollector<List<String>> {

    public static final String ID = "metrics";

    private final MetricsEndpoint metricsEndpoint;

    public MetricsCollector(MetricsEndpoint metricsEndpoint) {
        this.metricsEndpoint = metricsEndpoint;
    }

    @Override
    public String getId() { return ID; }

    @Override
    public CollectionResult<List<String>> collect() {
        var names = metricsEndpoint.listNames().getNames();
        return CollectionResult.success(names.stream().sorted().toList());
    }

    /** Fetch a single named metric with optional tag filters (format: "key:value"). */
    public CollectionResult<MetricData> collectOne(String name, List<String> tags) {
        // Use var to avoid referencing the inner class name, which differs across Boot versions
        var response = metricsEndpoint.metric(name, tags.isEmpty() ? null : tags);
        if (response == null) {
            return CollectionResult.unavailable(name);
        }

        List<MetricData.Measurement> measurements = response.getMeasurements().stream()
                .map(m -> new MetricData.Measurement(m.getStatistic().name(), m.getValue()))
                .toList();

        List<Map<String, String>> availableTags = response.getAvailableTags().stream()
                .map(t -> Map.of("tag", t.getTag(), "values", String.join(",", t.getValues())))
                .toList();

        return CollectionResult.success(new MetricData(
                response.getName(),
                response.getDescription(),
                response.getBaseUnit(),
                measurements,
                availableTags
        ));
    }
}
