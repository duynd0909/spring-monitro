package com.spring.monitro.core.alerting;

import com.spring.monitro.core.model.Alert;
import com.spring.monitro.core.model.AlertRule;

import java.util.List;

public interface AlertStateManager {
    List<Alert> getAlerts();
    List<AlertRule> getRules();
}
