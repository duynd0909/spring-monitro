package com.spring.monitro.alerting.notification;

import com.spring.monitro.core.model.Alert;

public interface AlertNotifier {
    void notify(Alert alert);
}
