package com.spring.monitro.starter;

import org.springframework.boot.actuate.autoconfigure.endpoint.EndpointAutoConfiguration;
import org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointAutoConfiguration;
import org.springframework.boot.actuate.autoconfigure.health.HealthEndpointAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;

/**
 * Top-level auto-configuration for Spring-Monitro.
 *
 * The after = {...} ordering is critical: @ConditionalOnBean(HealthEndpoint.class) in
 * MonitorActuatorConfiguration evaluates to false if processed before Spring Boot's own
 * Actuator configurations have registered their bean definitions. Declaring after these
 * three Actuator configs guarantees their beans exist when our conditions are evaluated.
 */
@AutoConfiguration(after = {
        EndpointAutoConfiguration.class,
        WebEndpointAutoConfiguration.class,
        HealthEndpointAutoConfiguration.class
})
@ConditionalOnProperty(name = "embedded.monitor.enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(MonitorProperties.class)
@Import({
        MonitorCoreConfiguration.class,
        MonitorActuatorConfiguration.class,
        MonitorServerConfiguration.class,
        MonitorAlertingConfiguration.class
})
public class MonitorAutoConfiguration {
}
