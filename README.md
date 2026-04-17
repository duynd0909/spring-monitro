# Spring-Monitro

An embedded monitoring platform for Spring Boot applications. Ships as a single starter dependency — no separate server, no registration protocol, no extra infrastructure.

The admin UI and REST API run on a **dedicated second port** (default `8090`) inside your existing JVM process, backed directly by Spring Actuator endpoint beans with zero HTTP round-trips.

---

## How it works

```
Your JVM Process
├── Main Application Context  (port 8080)
│   ├── Spring Actuator beans  (HealthEndpoint, MetricsEndpoint, …)
│   ├── Your application beans
│   └── Spring-Monitro beans:
│       ├── CollectorRegistry   ← wraps Actuator endpoint beans in-process
│       ├── MonitorWebServer    ← SmartLifecycle, owns the child context
│       └── AlertEvaluator      ← scheduled rule engine
│
└── Child WebApplicationContext  (port 8090)
    ├── DispatcherServlet   ← /monitro/api/*
    ├── REST Controllers    ← read from CollectorRegistry (parent bean)
    ├── Basic Auth Filter   ← isolated from parent Spring Security
    └── Static DefaultServlet ← serves the Vue 3 SPA
```

---

## Quick start

### 1. Add the dependency

```xml
<dependency>
    <groupId>com.spring.monitro</groupId>
    <artifactId>monitor-starter</artifactId>
    <version>0.1.0-SNAPSHOT</version>
</dependency>
```

### 2. Expose Actuator endpoints

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,loggers,threaddump
  endpoint:
    health:
      show-details: always
```

### 3. Set a password (required for BASIC mode)

```yaml
embedded:
  monitor:
    security:
      password: changeme
```

### 4. Open the admin UI

```
http://localhost:8090/monitro/index.html
```

Default credentials: `monitro` / `<your password>`

---

## Configuration reference

All properties live under the `embedded.monitor` namespace.

```yaml
embedded:
  monitor:
    enabled: true                          # Master kill switch

    server:
      port: 8090                           # Admin port
      context-path: /monitro               # Context path prefix
      address: 0.0.0.0                     # Bind address

    security:
      mode: BASIC                          # NONE | BASIC
      username: monitro
      password: ""                         # Required when mode=BASIC
      realm: Spring-Monitro

    metrics:
      include: ["*"]                       # Ant-style patterns
      exclude: []
      max-results: 500

    alerting:
      enabled: true
      evaluation-interval: 30s
      rules:
        - id: high-heap
          name: High Heap Usage
          metric: jvm.memory.used
          tags:
            area: heap
          threshold: 536870912             # bytes
          operator: GT                     # GT | GTE | LT | LTE | EQ
          severity: WARN                   # INFO | WARN | CRITICAL
          for-consecutive: 2              # consecutive breaches before firing

    ui:
      enabled: true
      title: Spring-Monitro
      refresh-interval: 10               # seconds
      theme: LIGHT                       # LIGHT | DARK
```

### Security modes

| Mode | Behavior |
|------|----------|
| `BASIC` | HTTP Basic Auth required on all `/api/*` requests. Default. |
| `NONE` | No authentication. Suitable for local development only. |

The filter is a plain Jakarta Servlet filter — no Spring Security dependency required, no interference with your app's `SecurityFilterChain`.

---

## REST API

All paths under the configured context path (default `/monitro`). All responses use the envelope:

```json
{ "status": "ok", "data": { ... }, "timestamp": "2026-04-17T10:00:00Z" }
```

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ping` | Liveness check |
| `GET` | `/api/health` | Overall + component health |
| `GET` | `/api/metrics` | List of available metric names |
| `GET` | `/api/metrics/{name}` | Single metric value + tags (`?tag=area:heap`) |
| `GET` | `/api/environment` | All property sources (values masked by Actuator) |
| `GET` | `/api/loggers` | All loggers + configured/effective levels |
| `POST` | `/api/loggers/{name}` | Change log level at runtime |
| `GET` | `/api/threaddump` | Full thread dump snapshot |
| `GET` | `/api/info` | App name, version, uptime, JVM info |
| `GET` | `/api/alerts` | Current alert states |
| `GET` | `/api/alerts/rules` | Configured alert rules |

### Logger level change

```bash
curl -X POST http://localhost:8090/monitro/api/loggers/com.example \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'
```

---

## Admin UI pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `#/` | Health badge, heap usage, uptime, app version |
| Health | `#/health` | Per-component status with detail expansion |
| Metrics | `#/metrics` | Searchable metric list; click to load value |
| Environment | `#/environment` | Property sources accordion with filter |
| Loggers | `#/loggers` | Table with inline level selector |
| Thread Dump | `#/threaddump` | Filterable thread list with stack trace toggle |
| Alerts | `#/alerts` | Active alerts and configured rules |

---

## Alerting

Alert rules evaluate on a configurable interval using a dedicated background thread (not `@EnableScheduling`).

```yaml
embedded:
  monitor:
    alerting:
      evaluation-interval: 30s
      rules:
        - id: high-heap
          name: High Heap Usage
          metric: jvm.memory.used
          tags: { area: heap }
          threshold: 1073741824    # 1 GB in bytes
          operator: GT
          severity: CRITICAL
          for-consecutive: 3       # must breach 3 times in a row before firing
```

**Operators:** `GT` (>), `GTE` (>=), `LT` (<), `LTE` (<=), `EQ` (==)

**Severities:** `INFO`, `WARN`, `CRITICAL`

When an alert fires or recovers, a log entry is written via `LoggingAlertNotifier`. Implement the `AlertNotifier` interface as a Spring bean to add custom notification (email, Slack, webhook, etc.):

```java
@Bean
public AlertNotifier slackNotifier() {
    return alert -> { /* post to Slack */ };
}
```

---

## Module structure

```
spring-monitro/
├── monitor-core/       Domain models, SPI interfaces, CollectorRegistry
├── monitor-actuator/   Adapters over Spring Actuator endpoint beans
├── monitor-server/     Child Tomcat, REST controllers, MVC config
├── monitor-ui/         Static Vue 3 SPA (no build step)
├── monitor-security/   Servlet filter-based Basic Auth
├── monitor-alerting/   Alert rule engine, state manager, notifiers
├── monitor-starter/    Auto-configuration entry point (the only dep users need)
└── monitor-sample/     Demo Spring Boot app
```

---

## Running the sample app

```bash
cd monitor-sample
JAVA_HOME=/path/to/java17 mvn spring-boot:run
```

Then open:
- Main app: http://localhost:8080
- Admin UI: http://localhost:8090/monitro/index.html (no auth in dev mode)

---

## Running tests

```bash
JAVA_HOME=/path/to/java17 mvn test -pl monitor-sample -am
```

The smoke test starts a full `@SpringBootTest` context and verifies ping, health, metrics, loggers, and UI asset serving.

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Java | 17+ |
| Spring Boot | 3.3.x |
| Spring Actuator | included via `spring-boot-starter-actuator` |

Spring-Monitro targets Servlet-based (Tomcat/Jetty/Undertow) apps only. WebFlux support is not available in v0.1.

---

## Limitations (v0.1)

- Each application instance monitors only itself — no multi-instance aggregation
- Admin port does not support random port assignment (always binds to the configured fixed port)
- Vue 3 and VueRouter are loaded from unpkg CDN — vendoring is planned for v0.2
- No logfile streaming, beans explorer, or heap dump download (planned for Phase 2)
