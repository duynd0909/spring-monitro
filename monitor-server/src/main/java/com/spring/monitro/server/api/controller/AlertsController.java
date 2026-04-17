package com.spring.monitro.server.api.controller;

import com.spring.monitro.core.alerting.AlertStateManager;
import com.spring.monitro.server.api.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AlertsController {

    @Autowired(required = false)
    private AlertStateManager alertStateManager;

    @GetMapping("/api/alerts")
    public ApiResponse<?> getAlerts() {
        if (alertStateManager == null) return ApiResponse.unavailable("alerts");
        return ApiResponse.ok(alertStateManager.getAlerts());
    }

    @GetMapping("/api/alerts/rules")
    public ApiResponse<?> getRules() {
        if (alertStateManager == null) return ApiResponse.unavailable("alerts");
        return ApiResponse.ok(alertStateManager.getRules());
    }
}
