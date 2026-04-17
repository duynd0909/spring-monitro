package com.spring.monitro.core.model;

import java.util.Map;

public class HealthData {

    private final String status;
    private final Map<String, ComponentHealth> components;

    public HealthData(String status, Map<String, ComponentHealth> components) {
        this.status = status;
        this.components = components;
    }

    public String getStatus() { return status; }
    public Map<String, ComponentHealth> getComponents() { return components; }

    public static class ComponentHealth {
        private final String status;
        private final Map<String, Object> details;

        public ComponentHealth(String status, Map<String, Object> details) {
            this.status = status;
            this.details = details;
        }

        public String getStatus() { return status; }
        public Map<String, Object> getDetails() { return details; }
    }
}
