package com.spring.monitro.core.model;

import java.util.List;
import java.util.Map;

public class MetricData {

    private final String name;
    private final String description;
    private final String baseUnit;
    private final List<Measurement> measurements;
    private final List<Map<String, String>> availableTags;

    public MetricData(String name, String description, String baseUnit,
                      List<Measurement> measurements, List<Map<String, String>> availableTags) {
        this.name = name;
        this.description = description;
        this.baseUnit = baseUnit;
        this.measurements = measurements;
        this.availableTags = availableTags;
    }

    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getBaseUnit() { return baseUnit; }
    public List<Measurement> getMeasurements() { return measurements; }
    public List<Map<String, String>> getAvailableTags() { return availableTags; }

    public record Measurement(String statistic, double value) {}
}
