package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.core.model.InfoData;
import com.spring.monitro.server.api.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InfoController {

    @Autowired(required = false)
    private CollectorRegistry collectorRegistry;

    @GetMapping("/api/info")
    public ApiResponse<?> info() {
        if (collectorRegistry == null || !collectorRegistry.hasCollector("info")) {
            return ApiResponse.unavailable("info");
        }
        CollectionResult<InfoData> result = collectorRegistry.collect("info");
        return result.isSuccess() ? ApiResponse.ok(result.getData()) : ApiResponse.error(result.getError().getMessage());
    }
}
