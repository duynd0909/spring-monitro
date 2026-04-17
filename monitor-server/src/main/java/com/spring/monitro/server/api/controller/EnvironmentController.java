package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.core.model.EnvironmentData;
import com.spring.monitro.server.api.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EnvironmentController {

    @Autowired(required = false)
    private CollectorRegistry collectorRegistry;

    @GetMapping("/api/environment")
    public ApiResponse<?> environment() {
        if (collectorRegistry == null || !collectorRegistry.hasCollector("environment")) {
            return ApiResponse.unavailable("environment");
        }
        CollectionResult<EnvironmentData> result = collectorRegistry.collect("environment");
        return result.isSuccess() ? ApiResponse.ok(result.getData()) : ApiResponse.error(result.getError().getMessage());
    }
}
