# Alerting

## Overview

The alert engine evaluates configured metric threshold rules on a fixed interval using a
dedicated background thread. It does **not** use `@EnableScheduling` — a named
`ScheduledExecutorService` bean avoids any conflicts with the parent application's
`@Scheduled` tasks.

---

## Configuration

```yaml
embedded:
  monitor:
    alerting:
      enabled: true                  # default: true
      evaluation-interval: 30s       # any java.time.Duration string

      rules:
        - id: high-heap              # unique identifier
          name: High Heap Usage      # human-readable label
          metric: jvm.memory.used    # Micrometer metric name
          tags:
            area: heap               # tag filters (key: value)
          threshold: 536870912       # compared against the metric VALUE measurement
          operator: GT               # GT | GTE | LT | LTE | EQ
          severity: WARN             # INFO | WARN | CRITICAL
          for-consecutive: 2         # breaches needed before alert fires (debounce)
```

Set `alerting.enabled: false` to disable the engine entirely (no scheduler thread started).

---

## How evaluation works

```
Every evaluation-interval:
  For each AlertRule:
    1. Call MetricsEndpoint.metric(rule.metric, rule.tags)
    2. Extract the VALUE (or TOTAL) measurement
    3. Apply rule.operator: VALUE > rule.threshold ?
    4. If breached: increment consecutiveBreaches count
       If not breached: reset count to 0
    5. Fire if: consecutiveBreaches >= rule.forConsecutive
    6. Recover if: previously firing AND now not breaching
    7. On state change: call all AlertNotifier beans
```

`for-consecutive: N` prevents brief metric spikes from triggering false-positive alerts.
An alert only fires after N consecutive evaluation cycles all breach the threshold.

---

## Alert states

| State | Meaning |
|-------|---------|
| Not in state map | Rule has never been evaluated |
| `firing: false` | Rule evaluated; threshold not breached (or recovered) |
| `firing: true` | Threshold breached for N consecutive cycles |

State is stored in-memory in `DefaultAlertStateManager` (a `ConcurrentHashMap`).
State does **not** persist across restarts.

---

## Custom notifiers

Implement `com.spring.monitro.alerting.notification.AlertNotifier` and register it as a
Spring bean anywhere in the parent application context:

```java
import com.spring.monitro.alerting.notification.AlertNotifier;
import com.spring.monitro.core.model.Alert;

@Component
public class SlackAlertNotifier implements AlertNotifier {

    @Override
    public void notify(Alert alert) {
        String msg = alert.firing()
            ? String.format(":red_circle: FIRING [%s] %s (severity: %s)",
                alert.ruleId(), alert.ruleName(), alert.severity())
            : String.format(":large_green_circle: RESOLVED [%s] %s",
                alert.ruleId(), alert.ruleName());
        // post msg to Slack webhook ...
    }
}
```

The default `LoggingAlertNotifier` is `@ConditionalOnMissingBean(AlertNotifier.class)`.
Defining **any** `AlertNotifier` bean replaces it. To keep logging **and** add another
notifier, define both beans explicitly.

---

## Alert data model

```java
// monitor-core/src/main/java/com/spring/monitro/core/model/Alert.java
record Alert(
    String ruleId,
    String ruleName,
    String severity,         // "INFO", "WARN", "CRITICAL"
    boolean firing,
    Instant since,           // when the current state began
    int consecutiveBreaches
) {}

// monitor-core/src/main/java/com/spring/monitro/core/model/AlertRule.java
record AlertRule(
    String id, String name, String metric,
    Map<String, String> tags,
    double threshold, String operator, String severity,
    int forConsecutive
) {}
```

---

## Wiring in the starter

`MonitorAlertingConfiguration` in `spring-monitro-starter`:
1. Converts `MonitorProperties.Alerting.AlertRuleProperties` → `AlertRule` records
2. Creates `DefaultAlertStateManager(rules)` bean
3. Creates `AlertEvaluator(metricsEndpoint, stateManager, notifiers, interval)` bean
4. Creates `LoggingAlertNotifier` bean `@ConditionalOnMissingBean`

`AlertsController` in `monitor-server` injects `AlertStateManager` (the interface from
`monitor-core`) — this works because the child context's parent is the main context where
`DefaultAlertStateManager` lives.
