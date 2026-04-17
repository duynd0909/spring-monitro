package com.spring.monitro.actuator.collector;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.MonitorDataCollector;
import com.spring.monitro.core.model.LoggerData;
import org.springframework.boot.actuate.logging.LoggersEndpoint;
import org.springframework.boot.logging.LogLevel;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class LoggersCollector implements MonitorDataCollector<LoggerData> {

    public static final String ID = "loggers";

    private final LoggersEndpoint loggersEndpoint;

    public LoggersCollector(LoggersEndpoint loggersEndpoint) {
        this.loggersEndpoint = loggersEndpoint;
    }

    @Override
    public String getId() { return ID; }

    @Override
    public CollectionResult<LoggerData> collect() {
        var descriptor = loggersEndpoint.loggers();

        // getLevels() returns Collection<LogLevel> in Spring Boot 3.3.x
        List<String> levels = descriptor.getLevels().stream()
                .map(Object::toString)
                .toList();

        Map<String, LoggerData.LoggerInfo> loggers = new LinkedHashMap<>();
        descriptor.getLoggers().forEach((name, info) -> {
            // getConfiguredLevel() is available on LoggerLevelsDescriptor.
            // getEffectiveLevel() only exists on SingleLoggerLevelsDescriptor.
            String configured = info.getConfiguredLevel() != null
                    ? info.getConfiguredLevel().toString() : null;
            String effective = null;
            if (info instanceof LoggersEndpoint.SingleLoggerLevelsDescriptor single) {
                effective = single.getEffectiveLevel() != null
                        ? single.getEffectiveLevel().toString() : null;
            }
            loggers.put(name, new LoggerData.LoggerInfo(configured, effective));
        });

        return CollectionResult.success(new LoggerData(levels, loggers));
    }

    /** Apply a log level change directly to the Actuator endpoint. */
    public void setLevel(String loggerName, String level) {
        loggersEndpoint.configureLogLevel(loggerName,
                level != null ? LogLevel.valueOf(level) : null);
    }
}
