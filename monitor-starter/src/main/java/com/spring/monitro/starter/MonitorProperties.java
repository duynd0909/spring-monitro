package com.spring.monitro.starter;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Configuration properties for Spring-Monitro.
 * All keys live under the {@code embedded.monitor} namespace.
 *
 * Minimum viable configuration:
 * <pre>
 * embedded:
 *   monitor:
 *     security:
 *       password: changeme
 * </pre>
 */
@ConfigurationProperties(prefix = "embedded.monitor")
public class MonitorProperties {

    /** Master kill switch. Set to false to disable the admin server entirely. */
    private boolean enabled = true;

    private final Server server = new Server();
    private final Security security = new Security();
    private final Metrics metrics = new Metrics();
    private final Alerting alerting = new Alerting();
    private final Ui ui = new Ui();

    // -------------------------------------------------------------------------
    // Server
    // -------------------------------------------------------------------------

    public static class Server {
        /** TCP port for the admin server. Default: 8090 */
        private int port = 8090;
        /** Servlet context path. Default: /monitro */
        private String contextPath = "/monitro";
        /** Bind address. Default: 0.0.0.0 (all interfaces) */
        private String address = "0.0.0.0";

        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        public String getContextPath() { return contextPath; }
        public void setContextPath(String contextPath) { this.contextPath = contextPath; }
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
    }

    // -------------------------------------------------------------------------
    // Security
    // -------------------------------------------------------------------------

    public static class Security {
        /** Auth mode for the admin port. Default: BASIC */
        private SecurityMode mode = SecurityMode.BASIC;
        /** Username for BASIC mode. Default: monitro */
        private String username = "monitro";
        /** Password for BASIC mode. Required when mode=BASIC. */
        private String password;
        /** Realm shown in browser auth dialog. Default: Spring-Monitro */
        private String realm = "Spring-Monitro";

        public SecurityMode getMode() { return mode; }
        public void setMode(SecurityMode mode) { this.mode = mode; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getRealm() { return realm; }
        public void setRealm(String realm) { this.realm = realm; }

        public enum SecurityMode { NONE, BASIC }
    }

    // -------------------------------------------------------------------------
    // Metrics
    // -------------------------------------------------------------------------

    public static class Metrics {
        /** Ant-style metric name patterns to include. Default: all ("*") */
        private List<String> include = new ArrayList<>(List.of("*"));
        /** Ant-style metric name patterns to exclude. */
        private List<String> exclude = new ArrayList<>();
        /** Max metric names returned by the list endpoint. Default: 500 */
        private int maxResults = 500;

        public List<String> getInclude() { return include; }
        public void setInclude(List<String> include) { this.include = include; }
        public List<String> getExclude() { return exclude; }
        public void setExclude(List<String> exclude) { this.exclude = exclude; }
        public int getMaxResults() { return maxResults; }
        public void setMaxResults(int maxResults) { this.maxResults = maxResults; }
    }

    // -------------------------------------------------------------------------
    // Alerting
    // -------------------------------------------------------------------------

    public static class Alerting {
        /** Enable the alert evaluation engine. Default: true */
        private boolean enabled = true;
        /** How often alert rules are evaluated. Default: 30s */
        private Duration evaluationInterval = Duration.ofSeconds(30);
        /** User-defined alert rules. */
        private List<AlertRuleProperties> rules = new ArrayList<>();

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public Duration getEvaluationInterval() { return evaluationInterval; }
        public void setEvaluationInterval(Duration evaluationInterval) { this.evaluationInterval = evaluationInterval; }
        public List<AlertRuleProperties> getRules() { return rules; }
        public void setRules(List<AlertRuleProperties> rules) { this.rules = rules; }

        public static class AlertRuleProperties {
            private String id;
            private String name;
            /** Micrometer metric name, e.g. jvm.memory.used */
            private String metric;
            /** Tag filters for the metric, e.g. {area: heap} */
            private Map<String, String> tags = new HashMap<>();
            private double threshold;
            private ThresholdOperator operator = ThresholdOperator.GT;
            private AlertSeverity severity = AlertSeverity.WARN;
            /** Consecutive breaches required before the alert fires. Default: 1 */
            private int forConsecutive = 1;

            public String getId() { return id; }
            public void setId(String id) { this.id = id; }
            public String getName() { return name; }
            public void setName(String name) { this.name = name; }
            public String getMetric() { return metric; }
            public void setMetric(String metric) { this.metric = metric; }
            public Map<String, String> getTags() { return tags; }
            public void setTags(Map<String, String> tags) { this.tags = tags; }
            public double getThreshold() { return threshold; }
            public void setThreshold(double threshold) { this.threshold = threshold; }
            public ThresholdOperator getOperator() { return operator; }
            public void setOperator(ThresholdOperator operator) { this.operator = operator; }
            public AlertSeverity getSeverity() { return severity; }
            public void setSeverity(AlertSeverity severity) { this.severity = severity; }
            public int getForConsecutive() { return forConsecutive; }
            public void setForConsecutive(int forConsecutive) { this.forConsecutive = forConsecutive; }
        }

        public enum ThresholdOperator { GT, GTE, LT, LTE, EQ }
        public enum AlertSeverity { INFO, WARN, CRITICAL }
    }

    // -------------------------------------------------------------------------
    // UI
    // -------------------------------------------------------------------------

    public static class Ui {
        /** Enable the embedded admin SPA. Set to false to expose API only. Default: true */
        private boolean enabled = true;
        /** Browser tab title. Default: Spring-Monitro */
        private String title = "Spring-Monitro";
        /** Auto-refresh interval in seconds. Default: 10 */
        private int refreshInterval = 10;
        private UiTheme theme = UiTheme.LIGHT;

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public int getRefreshInterval() { return refreshInterval; }
        public void setRefreshInterval(int refreshInterval) { this.refreshInterval = refreshInterval; }
        public UiTheme getTheme() { return theme; }
        public void setTheme(UiTheme theme) { this.theme = theme; }

        public enum UiTheme { LIGHT, DARK }
    }

    // -------------------------------------------------------------------------
    // Root accessors
    // -------------------------------------------------------------------------

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Server getServer() { return server; }
    public Security getSecurity() { return security; }
    public Metrics getMetrics() { return metrics; }
    public Alerting getAlerting() { return alerting; }
    public Ui getUi() { return ui; }
}
