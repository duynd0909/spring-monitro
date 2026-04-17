package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.core.model.ThreadData;
import com.spring.monitro.server.api.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ThreadDumpController {

    @Autowired(required = false)
    private CollectorRegistry collectorRegistry;

    @GetMapping("/api/threaddump")
    public ApiResponse<?> threadDump() {
        if (collectorRegistry == null || !collectorRegistry.hasCollector("threaddump")) {
            return ApiResponse.unavailable("threaddump");
        }
        CollectionResult<ThreadData> result = collectorRegistry.collect("threaddump");
        return result.isSuccess() ? ApiResponse.ok(result.getData()) : ApiResponse.error(result.getError().getMessage());
    }
}
