package com.spring.monitro.core.model;

import java.util.Map;

public record AlertRule(
        String id,
        String name,
        String metric,
        Map<String, String> tags,
        double threshold,
        String operator,
        String severity,
        int forConsecutive
) {}
