# REST API Reference

All endpoints are served on the admin port (default `8090`) under the configured
context path (default `/monitro`). Full base URL: `http://localhost:8090/monitro/api/`.

## Response envelope

Every response uses a consistent JSON envelope:

```json
{
  "status": "ok",
  "data": { ... },
  "message": null,
  "timestamp": "2026-04-17T10:00:00Z"
}
```

On error: `"status": "error"`, `"message": "reason"`, `"data": null`

On unavailable endpoint: `"status": "unavailable"`, `"data": null`

---

## Liveness

### `GET /api/ping`

Always returns `200 OK`. Useful for health checks on the admin port.

```json
{ "status": "ok", "data": "pong", "timestamp": "…" }
```

---

## Health

### `GET /api/health`

Returns overall application health and all component statuses.

```json
{
  "status": "ok",
  "data": {
    "status": "UP",
    "components": {
      "diskSpace": { "status": "UP", "details": { "total": 499963174912, "free": 349963174912 } },
      "db":        { "status": "UP", "details": { "database": "H2" } }
    }
  }
}
```

---

## Metrics

### `GET /api/metrics`

Returns a sorted list of all available metric names.

```json
{ "status": "ok", "data": ["disk.free", "jvm.gc.pause", "jvm.memory.max", "jvm.memory.used", "…"] }
```

### `GET /api/metrics/{name}`

Returns the current value of a single metric.

**Query parameters:** `tag=key:value` (repeatable) — e.g. `?tag=area:heap`

```json
{
  "status": "ok",
  "data": {
    "name": "jvm.memory.used",
    "description": "The amount of used memory",
    "baseUnit": "bytes",
    "measurements": [{ "statistic": "VALUE", "value": 83741720 }],
    "availableTags": [{ "tag": "area", "values": "heap,nonheap" }]
  }
}
```

---

## Environment

### `GET /api/environment`

Returns all property sources with their resolved values. Sensitive values are masked
(`******`) by Spring Actuator's built-in masking — not re-implemented here.

```json
{
  "status": "ok",
  "data": {
    "propertySources": [
      {
        "name": "Config resource 'class path resource [application.yml]'",
        "properties": {
          "server.port": { "value": "8080" },
          "spring.application.name": { "value": "spring-monitro-sample" }
        }
      }
    ]
  }
}
```

---

## Loggers

### `GET /api/loggers`

Returns all loggers with their configured and effective log levels.

```json
{
  "status": "ok",
  "data": {
    "levels": ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "OFF"],
    "loggers": {
      "ROOT": { "configuredLevel": "INFO", "effectiveLevel": "INFO" },
      "com.example": { "configuredLevel": null, "effectiveLevel": "INFO" }
    }
  }
}
```

### `POST /api/loggers/{name}`

Changes the log level of a named logger at runtime.

**Request body:**
```json
{ "configuredLevel": "DEBUG" }
```

Set `"configuredLevel": null` to reset to inherited level.

**Response:**
```json
{ "status": "ok", "data": "Logger 'com.example' set to DEBUG" }
```

---

## Thread Dump

### `GET /api/threaddump`

Returns a full snapshot of all JVM threads including stack traces.

```json
{
  "status": "ok",
  "data": {
    "threads": [
      {
        "threadId": 1,
        "threadName": "main",
        "threadState": "RUNNABLE",
        "daemon": false,
        "priority": 5,
        "blockedCount": 0,
        "waitedCount": 12,
        "stackTrace": [
          "java.lang.Thread.sleep(Native Method)",
          "com.example.MyService.run(MyService.java:42)"
        ]
      }
    ]
  }
}
```

Stack traces are limited to 30 frames per thread.

---

## Application Info

### `GET /api/info`

Returns application metadata combined from `InfoEndpoint` and JVM MXBeans.

```json
{
  "status": "ok",
  "data": {
    "name": "spring-monitro-sample",
    "version": "0.1.0-SNAPSHOT",
    "uptimeMs": 123456,
    "startTime": "2026-04-17T10:00:00Z",
    "jvmVendor": "Amazon.com Inc.",
    "jvmVersion": "17.0.11+9-LTS",
    "javaVersion": "17.0.11",
    "osName": "Windows 11",
    "osVersion": "10.0",
    "availableProcessors": 8,
    "pid": 12345
  }
}
```

---

## Alerts

### `GET /api/alerts`

Returns the current state of all alert rules that have been evaluated at least once.

```json
{
  "status": "ok",
  "data": [
    {
      "ruleId": "high-heap",
      "ruleName": "High Heap Usage",
      "severity": "WARN",
      "firing": true,
      "since": "2026-04-17T10:05:30Z",
      "consecutiveBreaches": 3
    }
  ]
}
```

### `GET /api/alerts/rules`

Returns the configured alert rules as loaded from `embedded.monitor.alerting.rules`.

```json
{
  "status": "ok",
  "data": [
    {
      "id": "high-heap",
      "name": "High Heap Usage",
      "metric": "jvm.memory.used",
      "tags": { "area": "heap" },
      "threshold": 536870912,
      "operator": "GT",
      "severity": "WARN",
      "forConsecutive": 2
    }
  ]
}
```

---

## Auth

When `embedded.monitor.security.mode=BASIC` (the default), all `/api/*` requests require
HTTP Basic Auth. Static assets (`/*.html`, `/assets/**`) are excluded.

```bash
# With credentials
curl -u monitro:changeme http://localhost:8090/monitro/api/health

# Without credentials → 401 with WWW-Authenticate: Basic realm="Spring-Monitro"
curl http://localhost:8090/monitro/api/health
```
