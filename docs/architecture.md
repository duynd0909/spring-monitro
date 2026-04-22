# Architecture

## Runtime model

```
JVM Process
├── Main ApplicationContext  (port 8080, managed by Spring Boot)
│   ├── Actuator endpoint beans   ← HealthEndpoint, MetricsEndpoint, …
│   ├── CollectorRegistry         ← wraps endpoint beans, accessed by child controllers
│   ├── DefaultAlertStateManager  ← thread-safe alert state, implements core interface
│   ├── AlertEvaluator            ← ScheduledExecutorService loop (SmartLifecycle)
│   └── MonitorWebServer          ← SmartLifecycle phase MAX_VALUE-1, owns child context
│
└── Child AnnotationConfigServletWebServerApplicationContext  (port 8090)
    ├── parent = main ApplicationContext   ← child beans can inject from parent
    ├── MonitorChildContextConfig          ← @EnableWebMvc, @Import security
    ├── MonitorSecurityChildConfig         ← FilterRegistrationBean on /api/*
    ├── DispatcherServlet on /
    ├── REST controllers on /api/*         ← @Autowired from parent: CollectorRegistry, endpoint beans
    └── Spring MVC ResourceHandler         ← /*.html, /assets/** → classpath:META-INF/resources/monitro/
```

### Why a child context?

The child `AnnotationConfigServletWebServerApplicationContext` is the only Spring Boot mechanism
that starts an embedded server (Tomcat) without replacing the main context's server.
Setting `childContext.setParent(parentCtx)` before `refresh()` merges the parent's
`Environment` (including `application.yml` property sources) into the child, making
`@Value("${embedded.monitor.*}")` resolution work without any extra wiring.

The parent **cannot** see child beans — this enforces that the admin port is invisible to
the main app's `SecurityFilterChain` and other parent beans.

---

## Module dependency graph

```
monitor-sample
    └── spring-monitro-starter
            ├── monitor-core          (domain models, SPI, CollectorRegistry)
            ├── monitor-actuator      (Actuator adapters, ActuatorCollectorRegistrar)
            ├── monitor-server        (child Tomcat, REST controllers, MVC config)
            │       └── monitor-security   (MonitorAuthenticationFilter)
            ├── monitor-security      (MonitorAuthenticationFilter)
            ├── monitor-alerting      (AlertEvaluator, DefaultAlertStateManager)
            └── monitor-ui            (static Vue 3 SPA resources)
```

**Acyclic constraint:** `monitor-server` must not depend on `spring-monitro-starter`
(circular). `MonitorWebServer` takes primitive constructor args instead of `MonitorProperties`.
All `@Value` expressions resolve through the merged child `Environment`.

---

## Key classes and their locations

| Class | Module | Role |
|---|---|---|
| `MonitorWebServer` | `monitor-server` | `SmartLifecycle` — creates and owns the child context |
| `MonitorChildContextConfig` | `monitor-server` | Child `@Configuration`: `@EnableWebMvc`, resource handlers, `@Import(MonitorSecurityChildConfig)` |
| `MonitorSecurityChildConfig` | `monitor-security` | Registers `MonitorAuthenticationFilter` as `FilterRegistrationBean` on `/api/*` |
| `MonitorAuthenticationFilter` | `monitor-security` | `GenericFilterBean` — constant-time Basic Auth |
| `ActuatorCollectorConfig` | `monitor-actuator` | Registers `SmartInitializingSingleton` that calls `ctx.getBean(EndpointClass)` for each collector |
| `CollectorRegistry` | `monitor-core` | `Map<String, MonitorDataCollector<?>>` — injected into child controllers |
| `AlertStateManager` | `monitor-core` | Interface — `getAlerts()`, `getRules()` — used by `AlertsController` |
| `DefaultAlertStateManager` | `monitor-alerting` | Implements `AlertStateManager`, tracks consecutive breach counts |
| `AlertEvaluator` | `monitor-alerting` | `SmartLifecycle` phase `MAX_VALUE-2` — `ScheduledExecutorService`, evaluates rules |
| `MonitorAutoConfiguration` | `spring-monitro-starter` | Entry point, `after = {EndpointAutoConfiguration, WebEndpointAutoConfiguration, HealthEndpointAutoConfiguration}` |
| `MonitorProperties` | `spring-monitro-starter` | `@ConfigurationProperties("embedded.monitor")` — all user config |

---

## Actuator collector registration

Collectors cannot use `@ConditionalOnBean(MetricsEndpoint.class)` because that condition
evaluates at configuration-processing time, before Actuator's own auto-configurations
have registered their beans.

`ActuatorCollectorRegistrar` implements `SmartInitializingSingleton`:
```
afterSingletonsInstantiated() — guaranteed to run after ALL parent context singletons exist
    → ctx.getBean(HealthEndpoint.class)    → register HealthCollector
    → ctx.getBean(MetricsEndpoint.class)   → register MetricsCollector
    … (catch NoSuchBeanDefinitionException for each — collector silently absent)
```

---

## Security isolation

`MonitorSecurityChildConfig` is registered in the **child** context only (via `@Import` in
`MonitorChildContextConfig`). The `FilterRegistrationBean` registers on the child
`ServletContext`, not the parent's. The parent app's `SecurityFilterChain` never sees
admin requests.

`@ConditionalOnProperty(name = "embedded.monitor.security.mode", havingValue = "BASIC", matchIfMissing = true)`
means the filter is active unless the user explicitly sets `mode: NONE`.

---

## Alert evaluation

`AlertEvaluator` (phase `MAX_VALUE-2`, starts before `MonitorWebServer` at `MAX_VALUE-1`):
1. `ScheduledExecutorService` (single daemon thread `monitro-alert-evaluator`)
2. For each configured `AlertRule`: calls `MetricsEndpoint.metric(name, tags)`
3. Extracts the `VALUE` or `TOTAL` measurement
4. Applies `operator` comparison against `threshold`
5. Calls `DefaultAlertStateManager.updateState(rule, breached)` — returns changed `Alert` or `null`
6. On state change: calls all `AlertNotifier` beans in the parent context

`DefaultAlertStateManager` implements `AlertStateManager` (defined in `monitor-core`)
so `AlertsController` in the child context can inject it via the parent-context hierarchy
without `monitor-server` depending on `monitor-alerting`.

---

## Static asset serving

`MonitorChildContextConfig.addResourceHandlers()` registers two handlers:
- `/*.html`, `/*.ico` → `classpath:/META-INF/resources/monitro/`
- `/assets/**` → `classpath:/META-INF/resources/monitro/assets/`

The `monitor-ui` jar puts files at `META-INF/resources/monitro/…` so Spring's classpath
resource resolution picks them up automatically when `monitor-ui` is on the classpath.

The Vue 3 SPA uses hash routing (`#/health`, `#/metrics`, …) — no server-side routing needed,
so there is no catch-all controller. `index.html` is opened directly.
