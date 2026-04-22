package com.spring.monitro.actuator.config;

import com.spring.monitro.actuator.collector.*;
import com.spring.monitro.core.collector.CollectorRegistry;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Creates and registers all Actuator-backed collectors.
 *
 * Uses SmartInitializingSingleton rather than @ConditionalOnBean to avoid the
 * bean-ordering trap: @ConditionalOnBean evaluates at configuration class processing
 * time, which can happen before MetricsEndpoint / EnvironmentEndpoint / etc. are
 * registered by their own autoconfiguration classes. SmartInitializingSingleton runs
 * after ALL singleton beans in the context are created, so every Actuator endpoint
 * bean is guaranteed to exist.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(name = "org.springframework.boot.actuate.health.HealthEndpoint")
public class ActuatorCollectorConfig {

    @Bean
    public ActuatorCollectorRegistrar actuatorCollectorRegistrar(
            CollectorRegistry registry,
            ApplicationContext applicationContext) {
        return new ActuatorCollectorRegistrar(registry, applicationContext);
    }

    public static class ActuatorCollectorRegistrar implements SmartInitializingSingleton {

        private final CollectorRegistry registry;
        private final ApplicationContext ctx;

        public ActuatorCollectorRegistrar(CollectorRegistry registry, ApplicationContext ctx) {
            this.registry = registry;
            this.ctx = ctx;
        }

        @Override
        public void afterSingletonsInstantiated() {
            tryRegister("health",
                    org.springframework.boot.actuate.health.HealthEndpoint.class,
                    HealthCollector::new);
            tryRegister("metrics",
                    org.springframework.boot.actuate.metrics.MetricsEndpoint.class,
                    MetricsCollector::new);
            tryRegister("environment",
                    org.springframework.boot.actuate.env.EnvironmentEndpoint.class,
                    EnvironmentCollector::new);
            tryRegister("loggers",
                    org.springframework.boot.actuate.logging.LoggersEndpoint.class,
                    LoggersCollector::new);
            tryRegister("threaddump",
                    org.springframework.boot.actuate.management.ThreadDumpEndpoint.class,
                    ThreadDumpCollector::new);
            String appName = ctx.getEnvironment().getProperty("spring.application.name");
            tryRegister("info",
                    org.springframework.boot.actuate.info.InfoEndpoint.class,
                    ep -> new InfoCollector(ep, appName));
            tryRegister("snapshot",
                    org.springframework.boot.actuate.metrics.MetricsEndpoint.class,
                    SnapshotCollector::new);
        }

        private <T> void tryRegister(String id, Class<T> endpointClass,
                                      java.util.function.Function<T, com.spring.monitro.core.collector.MonitorDataCollector<?>> factory) {
            try {
                T endpoint = ctx.getBean(endpointClass);
                registry.register(factory.apply(endpoint));
            } catch (org.springframework.beans.factory.NoSuchBeanDefinitionException ignored) {
                // endpoint not on classpath or not enabled — collector simply absent
            }
        }
    }
}
