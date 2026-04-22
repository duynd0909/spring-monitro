# Development Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 17 (Corretto) | Path: `C:/Users/Admin/.jdks/corretto-17.0.11` |
| Maven | 3.9+ | Bundled via `mvnw` or system install |
| Spring Boot | 3.3.6 | Managed via root `pom.xml` BOM |

> **Important:** The system default Java may be Java 8. Always prefix Maven commands
> with `JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11"` or the build will fail with
> `invalid target release: 17`.

---

## Build commands

```bash
# Full build (all modules)
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn clean package -q

# Build specific module and its dependencies
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn package -pl monitor-server -am -q

# Build without running tests (faster)
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn package -DskipTests -q

# Run smoke tests
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn test -pl monitor-sample -am
```

### Module build order (Maven reactor order)

```
monitor-core → monitor-actuator → monitor-security → monitor-server
            → monitor-ui → monitor-alerting → spring-monitro-starter → monitor-sample
```

When editing files in `monitor-server`, you only need to rebuild:
```bash
JAVA_HOME="C:/Users/Admin/.jdks/corretto-17.0.11" mvn package -pl monitor-server,monitor-sample -am -q
```

---

## Running the sample app

```bash
# Using Java 17 explicitly (system default may be Java 8)
"C:/Users/Admin/.jdks/corretto-17.0.11/bin/java" -jar monitor-sample/target/monitor-sample-0.1.0-SNAPSHOT.jar

# With BASIC auth enabled
"C:/Users/Admin/.jdks/corretto-17.0.11/bin/java" -jar monitor-sample/target/monitor-sample-0.1.0-SNAPSHOT.jar \
  --embedded.monitor.security.mode=BASIC \
  --embedded.monitor.security.password=secret

# With an alert rule that fires immediately (heap > 0 bytes)
"C:/Users/Admin/.jdks/corretto-17.0.11/bin/java" -jar monitor-sample/target/monitor-sample-0.1.0-SNAPSHOT.jar \
  --embedded.monitor.security.mode=NONE \
  "--embedded.monitor.alerting.rules[0].id=test-heap" \
  "--embedded.monitor.alerting.rules[0].metric=jvm.memory.used" \
  "--embedded.monitor.alerting.rules[0].tags.area=heap" \
  "--embedded.monitor.alerting.rules[0].threshold=0" \
  "--embedded.monitor.alerting.rules[0].operator=GT" \
  "--embedded.monitor.alerting.evaluation-interval=5s"
```

URLs after startup:
- Main app: http://localhost:8080
- Admin UI: http://localhost:8090/monitro/index.html
- Ping: http://localhost:8090/monitro/api/ping

---

## Port conflicts

If Maven `clean` fails with "Failed to delete monitor-sample.jar", a previous Java process
is holding the file. Kill it first:

```powershell
powershell -Command "Get-Process java | Stop-Process -Force"
```

---

## Adding a new REST endpoint

1. **Add model** (if needed) in `monitor-core/.../core/model/`
2. **Add collector** in `monitor-actuator/.../actuator/collector/` — implement `MonitorDataCollector<T>`
3. **Register collector** in `ActuatorCollectorConfig.afterSingletonsInstantiated()` via `tryRegister()`
4. **Add controller** in `monitor-server/.../server/api/controller/` — `@RestController`, inject `CollectorRegistry`
5. **Add UI page** in `monitor-ui/.../assets/app.js` — add route, Vue component, nav entry

Controllers in the child context can `@Autowired(required = false)` any parent-context bean
(Actuator endpoint beans, `CollectorRegistry`, `AlertStateManager`, etc.).

---

## Adding a new alert notifier

Implement `AlertNotifier` and register it as a Spring `@Bean` in the parent context:

```java
@Bean
public AlertNotifier myNotifier() {
    return alert -> {
        if (alert.firing()) { /* fire */ }
        else { /* recover */ }
    };
}
```

The default `LoggingAlertNotifier` is `@ConditionalOnMissingBean(AlertNotifier.class)` —
defining your own bean replaces it.

---

## Module ownership cheat-sheet

| Task | Module |
|------|--------|
| Add a domain model (data record) | `monitor-core` |
| Add a new Actuator adapter | `monitor-actuator` |
| Add a REST endpoint | `monitor-server` |
| Change auth filter logic | `monitor-security` |
| Change alert evaluation | `monitor-alerting` |
| Change UI pages / Vue components | `monitor-ui` (assets/app.js, assets/app.css) |
| Change auto-configuration wiring | `spring-monitro-starter` |
| Add config properties | `spring-monitro-starter/MonitorProperties.java` |

---

## Known gotchas

### Java version
The system JDK is 1.8.0_202. Always use the explicit `JAVA_HOME` prefix or the compile
target error `invalid target release: 17` appears.

### Circular Maven dependency
`monitor-server` must NOT import `MonitorProperties` from `spring-monitro-starter`.
`MonitorWebServer` takes primitive constructor args; `MonitorChildContextConfig` uses `@Value`.

### `@ConditionalOnBean` timing
Actuator endpoint beans are not available at `@Configuration` processing time.
Collector registration uses `SmartInitializingSingleton.afterSingletonsInstantiated()`
which runs after ALL parent-context singletons are created.

### `PropertySourcesPlaceholderConfigurer` in child context
`MonitorChildContextConfig` declares a `static` `PropertySourcesPlaceholderConfigurer` bean.
It must be `static` because `BeanFactoryPostProcessor` beans need to be instantiated before
other beans. Without it, `@Value` placeholders in child context beans resolve as literal
strings like `${embedded.monitor.server.port:8090}`.

### `MetricsEndpoint` inner class
`MetricsEndpoint.MetricResponse` is an inner class whose name differs across Spring Boot
versions. Use `var response = metricsEndpoint.metric(…)` to avoid referencing it by name.

### `LoggersEndpoint.getLevels()`
Returns `Collection<?>` (not `Collection<LogLevel>`) in Spring Boot 3.3.x.
Use `.stream().map(Object::toString)` not `.map(Enum::name)`.

### `LoggersEndpoint` effective level
`getEffectiveLevel()` only exists on `SingleLoggerLevelsDescriptor`, not on the base
`LoggerLevelsDescriptor`. Always check `instanceof SingleLoggerLevelsDescriptor` before calling it.
