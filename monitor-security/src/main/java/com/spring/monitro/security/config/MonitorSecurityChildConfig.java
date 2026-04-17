package com.spring.monitro.security.config;

import com.spring.monitro.security.MonitorAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registered inside the child WebApplicationContext (admin port) to wire Basic Auth.
 *
 * Activates only when embedded.monitor.security.mode=BASIC (the default).
 * Setting mode=NONE skips filter registration entirely — suitable for dev/test.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(
        name = "embedded.monitor.security.mode",
        havingValue = "BASIC",
        matchIfMissing = true)
public class MonitorSecurityChildConfig {

    @Value("${embedded.monitor.security.username:monitro}")
    private String username;

    @Value("${embedded.monitor.security.password:}")
    private String password;

    @Value("${embedded.monitor.security.realm:Spring-Monitro}")
    private String realm;

    @Bean
    public FilterRegistrationBean<MonitorAuthenticationFilter> monitorAuthFilter() {
        var filter = new MonitorAuthenticationFilter(username, password, realm);
        var reg = new FilterRegistrationBean<>(filter);
        reg.addUrlPatterns("/api/*");
        reg.setOrder(1);
        reg.setName("monitorAuthFilter");
        return reg;
    }
}
