package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.core.model.HealthData;
import com.spring.monitro.server.api.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @Autowired(required = false)
    private CollectorRegistry collectorRegistry;

    @GetMapping("/api/health")
    public ApiResponse<?> health() {
        if (collectorRegistry == null || !collectorRegistry.hasCollector("health")) {
            return ApiResponse.unavailable("health");
        }
        CollectionResult<HealthData> result = collectorRegistry.collect("health");
        if (!result.isSuccess()) {
            return result.getError().isUnavailable()
                    ? ApiResponse.unavailable("health")
                    : ApiResponse.error(result.getError().getMessage());
        }
        return ApiResponse.ok(result.getData());
    }
}
