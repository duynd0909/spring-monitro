package com.spring.monitro.core.model;

import java.util.List;
import java.util.Map;

public class EnvironmentData {

    private final List<PropertySource> propertySources;

    public EnvironmentData(List<PropertySource> propertySources) {
        this.propertySources = propertySources;
    }

    public List<PropertySource> getPropertySources() { return propertySources; }

    public record PropertySource(String name, Map<String, Object> properties) {}
}
