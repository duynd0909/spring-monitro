package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.core.model.SnapshotData;
import com.spring.monitro.server.api.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SnapshotController {

    @Autowired(required = false)
    private CollectorRegistry collectorRegistry;

    @GetMapping("/api/snapshot")
    public ApiResponse<?> snapshot() {
        if (collectorRegistry == null || !collectorRegistry.hasCollector("snapshot")) {
            return ApiResponse.unavailable("snapshot");
        }
        CollectionResult<SnapshotData> result = collectorRegistry.collect("snapshot");
        return result.isSuccess()
                ? ApiResponse.ok(result.getData())
                : ApiResponse.error(result.getError().getMessage());
    }
}
