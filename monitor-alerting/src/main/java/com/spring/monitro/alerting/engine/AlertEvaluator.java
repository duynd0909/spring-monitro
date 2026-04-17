package com.spring.monitro.alerting.engine;

import com.spring.monitro.alerting.notification.AlertNotifier;
import com.spring.monitro.core.model.Alert;
import com.spring.monitro.core.model.AlertRule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.actuate.metrics.MetricsEndpoint;
import org.springframework.context.SmartLifecycle;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Scheduled alert evaluation loop using a dedicated ScheduledExecutorService.
 * Avoids @EnableScheduling to prevent interference with the parent app's scheduler.
 */
public class AlertEvaluator implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(AlertEvaluator.class);

    private final MetricsEndpoint metricsEndpoint;
    private final DefaultAlertStateManager stateManager;
    private final List<AlertNotifier> notifiers;
    private final Duration interval;

    private ScheduledExecutorService scheduler;
    private volatile boolean running = false;

    public AlertEvaluator(MetricsEndpoint metricsEndpoint,
                          DefaultAlertStateManager stateManager,
                          List<AlertNotifier> notifiers,
                          Duration interval) {
        this.metricsEndpoint = metricsEndpoint;
        this.stateManager = stateManager;
        this.notifiers = notifiers;
        this.interval = interval;
    }

    @Override
    public void start() {
        if (metricsEndpoint == null || stateManager.getRules().isEmpty()) {
            log.debug("Spring-Monitro alerting skipped: no MetricsEndpoint or no rules configured");
            return;
        }
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "monitro-alert-evaluator");
            t.setDaemon(true);
            return t;
        });
        long millis = interval.toMillis();
        scheduler.scheduleAtFixedRate(this::evaluateAll, millis, millis, TimeUnit.MILLISECONDS);
        running = true;
        log.info("Spring-Monitro alert evaluator started — {} rules, interval {}s",
                stateManager.getRules().size(), interval.toSeconds());
    }

    @Override
    public void stop() {
        running = false;
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
    }

    @Override
    public boolean isRunning() { return running; }

    @Override
    public int getPhase() { return Integer.MAX_VALUE - 2; }

    private void evaluateAll() {
        for (AlertRule rule : stateManager.getRules()) {
            try {
                evaluateRule(rule);
            } catch (Exception e) {
                log.warn("Alert rule evaluation failed for rule '{}': {}", rule.id(), e.getMessage());
            }
        }
    }

    private void evaluateRule(AlertRule rule) {
        List<String> tags = rule.tags().entrySet().stream()
                .map(e -> e.getKey() + ":" + e.getValue())
                .toList();
        var response = metricsEndpoint.metric(rule.metric(), tags.isEmpty() ? null : tags);
        if (response == null) return;

        double value = response.getMeasurements().stream()
                .filter(m -> "VALUE".equals(m.getStatistic().name()) || "TOTAL".equals(m.getStatistic().name()))
                .mapToDouble(MetricsEndpoint.Sample::getValue)
                .findFirst()
                .orElse(Double.NaN);

        if (Double.isNaN(value)) return;

        boolean breached = evaluate(value, rule.operator(), rule.threshold());
        Alert changed = stateManager.updateState(rule, breached);
        if (changed != null) {
            log.debug("Alert state change: rule={} firing={} value={}", rule.id(), changed.firing(), value);
            notifiers.forEach(n -> n.notify(changed));
        }
    }

    private static boolean evaluate(double value, String operator, double threshold) {
        return switch (operator.toUpperCase()) {
            case "GT"  -> value >  threshold;
            case "GTE" -> value >= threshold;
            case "LT"  -> value <  threshold;
            case "LTE" -> value <= threshold;
            case "EQ"  -> value == threshold;
            default    -> false;
        };
    }
}
