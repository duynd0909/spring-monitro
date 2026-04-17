package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.core.model.MetricData;
import com.spring.monitro.server.api.dto.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.metrics.MetricsEndpoint;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MetricsController {

    @Autowired(required = false)
    private CollectorRegistry collectorRegistry;

    @Autowired(required = false)
    private MetricsEndpoint metricsEndpoint;

    @GetMapping("/api/metrics")
    public ApiResponse<?> listMetrics() {
        if (collectorRegistry == null || !collectorRegistry.hasCollector("metrics")) {
            return ApiResponse.unavailable("metrics");
        }
        CollectionResult<List<String>> result = collectorRegistry.collect("metrics");
        return result.isSuccess() ? ApiResponse.ok(result.getData()) : ApiResponse.error(result.getError().getMessage());
    }

    @GetMapping("/api/metrics/{name}")
    public ApiResponse<?> getMetric(@PathVariable String name,
                                     @RequestParam(required = false) List<String> tag) {
        if (metricsEndpoint == null) {
            return ApiResponse.unavailable("metrics");
        }
        List<String> tags = tag != null ? tag : List.of();
        var response = metricsEndpoint.metric(name, tags.isEmpty() ? null : tags);
        if (response == null) {
            return ApiResponse.unavailable(name);
        }
        List<MetricData.Measurement> measurements = response.getMeasurements().stream()
                .map(m -> new MetricData.Measurement(m.getStatistic().name(), m.getValue()))
                .toList();
        List<Map<String, String>> availableTags = response.getAvailableTags().stream()
                .map(t -> Map.of("tag", t.getTag(), "values", String.join(",", t.getValues())))
                .toList();
        MetricData data = new MetricData(
                response.getName(),
                response.getDescription(),
                response.getBaseUnit(),
                measurements,
                availableTags
        );
        return ApiResponse.ok(data);
    }
}
