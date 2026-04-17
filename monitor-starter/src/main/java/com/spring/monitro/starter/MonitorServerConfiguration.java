package com.spring.monitro.starter;

import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.server.MonitorWebServer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class MonitorServerConfiguration {

    @Bean
    public MonitorWebServer monitorWebServer(ApplicationContext applicationContext,
                                              MonitorProperties properties,
                                              CollectorRegistry collectorRegistry) {
        MonitorProperties.Server server = properties.getServer();
        return new MonitorWebServer(
                applicationContext,
                collectorRegistry,
                properties.isEnabled(),
                server.getPort(),
                server.getContextPath(),
                server.getAddress()
        );
    }
}
