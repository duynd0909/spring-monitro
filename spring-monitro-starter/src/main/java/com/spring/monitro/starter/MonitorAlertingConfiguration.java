package com.spring.monitro.starter;

import com.spring.monitro.alerting.engine.AlertEvaluator;
import com.spring.monitro.alerting.engine.DefaultAlertStateManager;
import com.spring.monitro.alerting.notification.AlertNotifier;
import com.spring.monitro.alerting.notification.LoggingAlertNotifier;
import com.spring.monitro.core.model.AlertRule;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.metrics.MetricsEndpoint;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.Map;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "embedded.monitor.alerting.enabled", havingValue = "true", matchIfMissing = true)
public class MonitorAlertingConfiguration {

    @Bean
    public DefaultAlertStateManager alertStateManager(MonitorProperties properties) {
        List<AlertRule> rules = properties.getAlerting().getRules().stream()
                .map(r -> new AlertRule(
                        r.getId(), r.getName(), r.getMetric(),
                        Map.copyOf(r.getTags()),
                        r.getThreshold(),
                        r.getOperator().name(),
                        r.getSeverity().name(),
                        r.getForConsecutive()))
                .toList();
        return new DefaultAlertStateManager(rules);
    }

    @Bean
    public AlertEvaluator alertEvaluator(DefaultAlertStateManager stateManager,
                                          List<AlertNotifier> notifiers,
                                          MonitorProperties properties,
                                          @Autowired(required = false) MetricsEndpoint metricsEndpoint) {
        return new AlertEvaluator(
                metricsEndpoint,
                stateManager,
                notifiers,
                properties.getAlerting().getEvaluationInterval());
    }

    @Bean
    @ConditionalOnMissingBean(AlertNotifier.class)
    public LoggingAlertNotifier loggingAlertNotifier() {
        return new LoggingAlertNotifier();
    }
}
