package com.spring.monitro.core.model;

import java.util.List;
import java.util.Map;

public class LoggerData {

    private final List<String> levels;
    private final Map<String, LoggerInfo> loggers;

    public LoggerData(List<String> levels, Map<String, LoggerInfo> loggers) {
        this.levels = levels;
        this.loggers = loggers;
    }

    public List<String> getLevels() { return levels; }
    public Map<String, LoggerInfo> getLoggers() { return loggers; }

    public record LoggerInfo(String configuredLevel, String effectiveLevel) {}
}
