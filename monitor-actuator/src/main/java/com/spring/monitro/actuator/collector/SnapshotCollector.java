package com.spring.monitro.actuator.collector;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.MonitorDataCollector;
import com.spring.monitro.core.model.SnapshotData;
import org.springframework.boot.actuate.metrics.MetricsEndpoint;

import java.time.Instant;
import java.util.List;

public class SnapshotCollector implements MonitorDataCollector<SnapshotData> {

    public static final String ID = "snapshot";

    private final MetricsEndpoint metricsEndpoint;

    public SnapshotCollector(MetricsEndpoint metricsEndpoint) {
        this.metricsEndpoint = metricsEndpoint;
    }

    @Override
    public String getId() { return ID; }

    @Override
    public CollectionResult<SnapshotData> collect() {
        return CollectionResult.success(new SnapshotData(
                Instant.now(),
                gauge("jvm.memory.used",     List.of("area:heap")),
                gauge("jvm.memory.max",      List.of("area:heap")),
                gauge("jvm.memory.committed", List.of("area:heap")),
                gauge("jvm.threads.live",    List.of()),
                gauge("jvm.threads.daemon",  List.of()),
                gauge("jvm.threads.peak",    List.of()),
                gauge("process.cpu.usage",   List.of()),
                gauge("system.cpu.usage",    List.of())
        ));
    }

    private Double gauge(String name, List<String> tags) {
        try {
            var response = metricsEndpoint.metric(name, tags.isEmpty() ? null : tags);
            if (response == null) return null;
            return response.getMeasurements().stream()
                    .filter(m -> "VALUE".equals(m.getStatistic().name()))
                    .mapToDouble(m -> m.getValue())
                    .boxed()
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
