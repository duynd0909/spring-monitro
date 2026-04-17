package com.spring.monitro.alerting.notification;

import com.spring.monitro.core.model.Alert;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LoggingAlertNotifier implements AlertNotifier {

    private static final Logger log = LoggerFactory.getLogger(LoggingAlertNotifier.class);

    @Override
    public void notify(Alert alert) {
        if (alert.firing()) {
            log.warn("ALERT FIRING [{}] {} — severity: {}", alert.ruleId(), alert.ruleName(), alert.severity());
        } else {
            log.info("ALERT RESOLVED [{}] {}", alert.ruleId(), alert.ruleName());
        }
    }
}
