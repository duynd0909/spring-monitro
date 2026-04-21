package com.spring.monitro.starter;

import com.spring.monitro.actuator.config.ActuatorCollectorConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(name = "org.springframework.boot.actuate.health.HealthEndpoint")
@Import(ActuatorCollectorConfig.class)
public class MonitorActuatorConfiguration {
}
