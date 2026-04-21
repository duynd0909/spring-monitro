package com.spring.monitro.server;

import com.spring.monitro.core.collector.CollectorRegistry;
import com.spring.monitro.server.config.MonitorChildContextConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.context.AnnotationConfigServletWebServerApplicationContext;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.SmartLifecycle;

/**
 * SmartLifecycle bean in the PARENT context that owns the child WebApplicationContext
 * running on the admin port.
 *
 * Phase = MAX_VALUE - 1 guarantees this starts after all parent context beans are ready
 * (including Actuator endpoint beans) and stops before the parent shuts down.
 *
 * Constructor accepts primitive config values rather than MonitorProperties directly,
 * which keeps monitor-server free of a compile-time dependency on monitor-starter
 * and avoids a circular Maven module dependency.
 */
public class MonitorWebServer implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(MonitorWebServer.class);

    private final ConfigurableApplicationContext parentContext;
    private final CollectorRegistry collectorRegistry;
    private final boolean enabled;
    private final int port;
    private final String contextPath;
    private final String address;

    private AnnotationConfigServletWebServerApplicationContext childContext;
    private volatile boolean running = false;

    public MonitorWebServer(ApplicationContext parentContext,
                            CollectorRegistry collectorRegistry,
                            boolean enabled,
                            int port,
                            String contextPath,
                            String address) {
        this.parentContext = (ConfigurableApplicationContext) parentContext;
        this.collectorRegistry = collectorRegistry;
        this.enabled = enabled;
        this.port = port;
        this.contextPath = contextPath;
        this.address = address;
    }

    @Override
    public void start() {
        if (!enabled) {
            log.info("Spring-Monitro is disabled (embedded.monitor.enabled=false)");
            return;
        }

        log.info("Starting Spring-Monitro admin server on port {}", port);

        childContext = new AnnotationConfigServletWebServerApplicationContext();
        childContext.setParent(parentContext);
        childContext.register(MonitorChildContextConfig.class);
        childContext.refresh();

        running = true;
        String displayAddress = "0.0.0.0".equals(address) ? "localhost" : address;
        log.info("Spring-Monitro admin server ready — http://{}:{}{}", displayAddress, port, contextPath);
    }

    @Override
    public void stop() {
        log.info("Stopping Spring-Monitro admin server");
        if (childContext != null && childContext.isActive()) {
            childContext.close();
        }
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE - 1;
    }

    @Override
    public boolean isAutoStartup() {
        return true;
    }
}
