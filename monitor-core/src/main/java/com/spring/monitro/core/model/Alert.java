package com.spring.monitro.core.model;

import java.time.Instant;

public record Alert(
        String ruleId,
        String ruleName,
        String severity,
        boolean firing,
        Instant since,
        int consecutiveBreaches
) {}
