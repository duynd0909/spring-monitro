package com.spring.monitro.actuator.collector;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.MonitorDataCollector;
import com.spring.monitro.core.model.InfoData;
import org.springframework.boot.actuate.info.InfoEndpoint;

import java.time.Instant;
import java.util.Map;

public class InfoCollector implements MonitorDataCollector<InfoData> {

    public static final String ID = "info";

    private final InfoEndpoint infoEndpoint;
    private final Instant startTime;

    public InfoCollector(InfoEndpoint infoEndpoint) {
        this.infoEndpoint = infoEndpoint;
        this.startTime = InfoData.processStartTime();
    }

    @Override
    public String getId() { return ID; }

    @Override
    public CollectionResult<InfoData> collect() {
        Map<String, Object> info = infoEndpoint.info();

        @SuppressWarnings("unchecked")
        Map<String, Object> build = (Map<String, Object>) info.getOrDefault("build", Map.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> git = (Map<String, Object>) info.getOrDefault("git", Map.of());

        String appName = build.getOrDefault("name", "unknown").toString();

        return CollectionResult.success(new InfoData(
                appName,
                build,
                git,
                info,
                InfoData.currentJvm(),
                startTime,
                InfoData.formatUptime(startTime)
        ));
    }
}
