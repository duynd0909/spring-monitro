package com.spring.monitro.server.config;

import com.spring.monitro.security.config.MonitorSecurityChildConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.PropertyPlaceholderConfigurer;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.servlet.server.ServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration registered in the child WebApplicationContext that owns the admin port.
 *
 * The child context's parent is the main application context, so beans declared here
 * can @Autowired beans from the parent (CollectorRegistry, Actuator endpoint beans).
 * The @Value expressions resolve from the merged parent+child Environment — because
 * MonitorWebServer calls childContext.setParent(parentCtx) before refresh, which merges
 * the parent's property sources (including application.yml) into the child's environment.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebMvc
@ComponentScan("com.spring.monitro.server.api.controller")
@Import(MonitorSecurityChildConfig.class)
public class MonitorChildContextConfig implements WebMvcConfigurer {

    @Value("${embedded.monitor.server.port:8090}")
    private int port;

    @Value("${embedded.monitor.server.context-path:/monitro}")
    private String contextPath;

    /**
     * Enables @Value placeholder resolution in the child context. Must be static so Spring
     * can create it as a BeanFactoryPostProcessor before any other beans are instantiated.
     * The child context inherits the parent's property sources via setParent(), so all
     * application.yml properties (including embedded.monitor.*) resolve correctly here.
     */
    @Bean
    public static PropertySourcesPlaceholderConfigurer propertySourcesPlaceholderConfigurer() {
        return new PropertySourcesPlaceholderConfigurer();
    }

    @Bean
    public ServletWebServerFactory servletWebServerFactory() {
        var factory = new TomcatServletWebServerFactory();
        factory.setPort(port);
        factory.setContextPath(contextPath);
        return factory;
    }

    @Bean
    public DispatcherServlet dispatcherServlet() {
        var ds = new DispatcherServlet();
        return ds;
    }

    @Bean
    public org.springframework.boot.web.servlet.ServletRegistrationBean<DispatcherServlet> dispatcherServletRegistration(
            DispatcherServlet ds) {
        var reg = new org.springframework.boot.web.servlet.ServletRegistrationBean<>(ds, "/");
        reg.setName("monitroDispatcher");
        reg.setLoadOnStartup(1);
        return reg;
    }

    /**
     * Serve static UI assets from the monitor-ui jar at /META-INF/resources/monitro/.
     * Effective for M3+ when monitor-ui is on the classpath.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/*.html", "/*.ico")
                .addResourceLocations("classpath:/META-INF/resources/monitro/");
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/META-INF/resources/monitro/assets/");
    }
}
