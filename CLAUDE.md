# Spring-Monitro — Claude Navigation Guide

## What this project is

An embedded Spring Boot monitoring starter. One dependency, no separate server.
Runs an admin UI + REST API on a dedicated second port (default 8090) inside the monitored JVM,
backed by Spring Actuator beans in-process — zero HTTP round-trips.

Docs: [docs/architecture.md](docs/architecture.md) | [docs/development.md](docs/development.md) | [docs/api-reference.md](docs/api-reference.md) | [docs/alerting.md](docs/alerting.md)

---

## CRITICAL: Java version

**System default Java is 1.8.0_202. All Maven commands must use:**
```bash
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn ...
```

**Running the jar:**
```bash
"C:/Users/Admin/.jdks/corretto-17.0.11/bin/java" -jar monitor-sample/target/monitor-sample-0.1.0-SNAPSHOT.jar
```

**Kill stuck Java processes before `mvn clean`:**
```powershell
powershell -Command "Get-Process java | Stop-Process -Force"
```

---

## Module map — where to find things

| Module | Package root | What lives here |
|--------|-------------|-----------------|
| `monitor-core` | `com.spring.monitro.core` | Domain models (`HealthData`, `MetricData`, `Alert`, `AlertRule`), SPI (`MonitorDataCollector`, `AlertStateManager`), `CollectorRegistry` |
| `monitor-actuator` | `com.spring.monitro.actuator` | Actuator adapters: `HealthCollector`, `MetricsCollector`, `EnvironmentCollector`, `LoggersCollector`, `ThreadDumpCollector`, `InfoCollector`; `ActuatorCollectorConfig` |
| `monitor-server` | `com.spring.monitro.server` | `MonitorWebServer` (SmartLifecycle), `MonitorChildContextConfig`, REST controllers (`/api/...`), `ApiResponse` DTO |
| `monitor-security` | `com.spring.monitro.security` | `MonitorAuthenticationFilter`, `MonitorSecurityChildConfig` |
| `monitor-alerting` | `com.spring.monitro.alerting` | `AlertEvaluator`, `DefaultAlertStateManager`, `AlertNotifier` SPI, `LoggingAlertNotifier` |
| `monitor-ui` | (no Java) | `src/main/resources/META-INF/resources/monitro/` → `index.html`, `assets/app.js`, `assets/app.css` |
| `spring-monitro-starter` | `com.spring.monitro.starter` | `MonitorAutoConfiguration`, `MonitorProperties`, configuration classes for core/actuator/server/alerting |
| `monitor-sample` | `com.spring.monitro.sample` | `SampleApplication`, `MonitorSmokeTest`, `application.yml` |

---

## Key files — open these first

| File | Why |
|------|-----|
| [spring-monitro-starter/.../MonitorAutoConfiguration.java](spring-monitro-starter/src/main/java/com/spring/monitro/starter/MonitorAutoConfiguration.java) | Entry point; `@Import` chain and `after=` ordering |
| [spring-monitro-starter/.../MonitorProperties.java](spring-monitro-starter/src/main/java/com/spring/monitro/starter/MonitorProperties.java) | All user-facing config (`embedded.monitor.*`) |
| [monitor-server/.../MonitorWebServer.java](monitor-server/src/main/java/com/spring/monitro/server/MonitorWebServer.java) | SmartLifecycle that creates the child context on the admin port |
| [monitor-server/.../config/MonitorChildContextConfig.java](monitor-server/src/main/java/com/spring/monitro/server/config/MonitorChildContextConfig.java) | Child context `@Configuration`: MVC, resource handlers, `@Import(MonitorSecurityChildConfig)` |
| [monitor-actuator/.../config/ActuatorCollectorConfig.java](monitor-actuator/src/main/java/com/spring/monitro/actuator/config/ActuatorCollectorConfig.java) | `SmartInitializingSingleton` that registers all collectors |
| [monitor-alerting/.../engine/AlertEvaluator.java](monitor-alerting/src/main/java/com/spring/monitro/alerting/engine/AlertEvaluator.java) | ScheduledExecutorService-based rule evaluation loop |
| [monitor-ui/.../assets/app.js](monitor-ui/src/main/resources/META-INF/resources/monitro/assets/app.js) | Entire Vue 3 SPA (all components, router, API client in one file) |
| [monitor-sample/.../application.yml](monitor-sample/src/main/resources/application.yml) | Dev config: port 8090, `security.mode=NONE`, actuator exposure |

---

## Build commands (copy-paste ready)

```bash
# Full build
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn clean package -q

# Rebuild after changing monitor-server or monitor-ui only
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn package -pl monitor-server,monitor-sample -am -q

# Rebuild after changing monitor-actuator
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn package -pl monitor-actuator,monitor-server,monitor-sample -am -q

# Rebuild after changing spring-monitro-starter or monitor-alerting
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn package -pl monitor-alerting,spring-monitro-starter,monitor-sample -am -q

# Run smoke tests
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn test -pl monitor-sample -am

# Run sample app (no auth, default port 8090)
"C:/Users/Admin/.jdks/corretto-17.0.11/bin/java" -jar monitor-sample/target/monitor-sample-0.1.0-SNAPSHOT.jar
```

---

## Architecture constraints — do not violate

1. **No circular Maven deps** — `monitor-server` must not import from `spring-monitro-starter`.
   `MonitorWebServer` takes primitive args; child context uses `@Value` for config.

2. **Collector registration via `SmartInitializingSingleton`** — never use `@ConditionalOnBean`
   for Actuator endpoint classes. It evaluates too early. Use `afterSingletonsInstantiated()`
   + `ctx.getBean()` + catch `NoSuchBeanDefinitionException`.

3. **`PropertySourcesPlaceholderConfigurer` must be `static`** in `MonitorChildContextConfig`.
   It is a `BeanFactoryPostProcessor` and must be created before all other beans.

4. **`AlertStateManager` interface lives in `monitor-core`** so `monitor-server`'s
   `AlertsController` can inject it without depending on `monitor-alerting`.

5. **Never use `@EnableScheduling`** in alerting — use `ScheduledExecutorService` directly
   to avoid conflict with the parent app's scheduler.

---

## Common tasks

### Add a new REST endpoint
1. Model (if needed) → `monitor-core/.../model/`
2. Collector → `monitor-actuator/.../collector/` (implement `MonitorDataCollector<T>`)
3. Register in `ActuatorCollectorConfig.afterSingletonsInstantiated()` via `tryRegister()`
4. Controller → `monitor-server/.../api/controller/` (inject `CollectorRegistry` or endpoint bean directly)
5. UI component → `monitor-ui/.../assets/app.js` (add route + nav entry)

### Add a new config property
Edit `MonitorProperties.java` in `spring-monitro-starter`. The `spring-boot-configuration-processor`
annotation processor generates IDE autocompletion metadata automatically at build time.

### Add a new alert notifier
Implement `AlertNotifier` (from `monitor-alerting`) as a Spring `@Bean`.
`LoggingAlertNotifier` is `@ConditionalOnMissingBean` so it is replaced automatically.

### Change the UI
Edit `monitor-ui/src/main/resources/META-INF/resources/monitro/assets/app.js`.
All Vue 3 components, the router, and the API client are in this single file.
Rebuild with `mvn package -pl monitor-ui,monitor-sample -am -q`.

---

## Testing

```bash
# Smoke tests (6 tests, ~8s): context load + ping + health + metrics + loggers + UI assets
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn test -pl monitor-sample -am
```

Tests use `@SpringBootTest(webEnvironment = RANDOM_PORT)` with `embedded.monitor.server.port=8090`
(fixed — admin port does not support random assignment) and `security.mode=NONE`.

Smoke test file: [monitor-sample/.../MonitorSmokeTest.java](monitor-sample/src/test/java/com/spring/monitro/sample/MonitorSmokeTest.java)

---

## Spring Boot API gotchas (3.3.x)

| API | Gotcha | Fix |
|-----|--------|-----|
| `MetricsEndpoint.metric()` return type | Inner class name differs across Boot versions | Use `var response = metricsEndpoint.metric(…)` |
| `LoggersEndpoint.getLevels()` | Returns `Collection<?>` not `Collection<LogLevel>` | `.stream().map(Object::toString)` |
| `LoggersEndpoint` effective level | `getEffectiveLevel()` only on `SingleLoggerLevelsDescriptor` | `instanceof` check before calling |
| `MetricsEndpoint.Sample.getStatistic()` | Returns Micrometer `Statistic` — needs `micrometer-core` on classpath | Add as optional dep, or use `.toString()` |
