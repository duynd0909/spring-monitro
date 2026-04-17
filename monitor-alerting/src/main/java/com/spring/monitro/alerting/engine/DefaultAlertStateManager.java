package com.spring.monitro.alerting.engine;

import com.spring.monitro.core.alerting.AlertStateManager;
import com.spring.monitro.core.model.Alert;
import com.spring.monitro.core.model.AlertRule;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

public class DefaultAlertStateManager implements AlertStateManager {

    private final List<AlertRule> rules;
    private final ConcurrentHashMap<String, Alert> states = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Integer> consecutiveCounts = new ConcurrentHashMap<>();

    public DefaultAlertStateManager(List<AlertRule> rules) {
        this.rules = List.copyOf(rules);
    }

    /**
     * Called by AlertEvaluator after each rule evaluation cycle.
     * Returns the alert if state changed (newly fired or recovered), else null.
     */
    public Alert updateState(AlertRule rule, boolean thresholdBreached) {
        int count = consecutiveCounts.merge(rule.id(), thresholdBreached ? 1 : 0,
                (prev, next) -> thresholdBreached ? prev + 1 : 0);

        boolean shouldFire = thresholdBreached && count >= rule.forConsecutive();
        Alert existing = states.get(rule.id());
        boolean wasFiring = existing != null && existing.firing();

        if (shouldFire == wasFiring) {
            return null; // no state change
        }

        Alert updated = new Alert(
                rule.id(), rule.name(), rule.severity(),
                shouldFire,
                shouldFire ? Instant.now() : (existing != null ? existing.since() : Instant.now()),
                count
        );
        states.put(rule.id(), updated);
        return updated;
    }

    @Override
    public List<Alert> getAlerts() {
        return new ArrayList<>(states.values());
    }

    @Override
    public List<AlertRule> getRules() {
        return rules;
    }
}
