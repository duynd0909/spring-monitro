package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.core.model.LoggerData;
import com.spring.monitro.server.api.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.logging.LoggersEndpoint;
import org.springframework.boot.logging.LogLevel;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class LoggersController {

    @Autowired(required = false)
    private CollectorRegistry collectorRegistry;

    @Autowired(required = false)
    private LoggersEndpoint loggersEndpoint;

    @GetMapping("/api/loggers")
    public ApiResponse<?> loggers() {
        if (collectorRegistry == null || !collectorRegistry.hasCollector("loggers")) {
            return ApiResponse.unavailable("loggers");
        }
        CollectionResult<LoggerData> result = collectorRegistry.collect("loggers");
        return result.isSuccess() ? ApiResponse.ok(result.getData()) : ApiResponse.error(result.getError().getMessage());
    }

    @PostMapping(value = "/api/loggers/{name}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<?> setLevel(@PathVariable String name,
                                    @RequestBody Map<String, String> body) {
        if (loggersEndpoint == null) {
            return ApiResponse.unavailable("loggers");
        }
        String level = body.get("configuredLevel");
        loggersEndpoint.configureLogLevel(name, level != null ? LogLevel.valueOf(level) : null);
        return ApiResponse.ok("Logger '" + name + "' set to " + level);
    }
}
