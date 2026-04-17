package com.spring.monitro.sample;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "embedded.monitor.server.port=8090",
                "embedded.monitor.security.mode=NONE",
                "management.endpoints.web.exposure.include=health,info,metrics,env,loggers,threaddump"
        })
class MonitorSmokeTest {

    private static final String ADMIN_BASE = "http://localhost:8090/monitro";

    @Test
    void contextLoads() {
        // If Spring context fails to start, this test fails automatically.
    }

    @Test
    void adminPingReturns200() {
        TestRestTemplate client = new TestRestTemplate();
        ResponseEntity<String> resp = client.getForEntity(ADMIN_BASE + "/api/ping", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("\"status\":\"ok\"");
    }

    @Test
    void healthEndpointReturns200() {
        TestRestTemplate client = new TestRestTemplate();
        ResponseEntity<String> resp = client.getForEntity(ADMIN_BASE + "/api/health", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void metricsListReturns200() {
        TestRestTemplate client = new TestRestTemplate();
        ResponseEntity<String> resp = client.getForEntity(ADMIN_BASE + "/api/metrics", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("jvm.memory");
    }

    @Test
    void loggersEndpointReturns200() {
        TestRestTemplate client = new TestRestTemplate();
        ResponseEntity<String> resp = client.getForEntity(ADMIN_BASE + "/api/loggers", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void staticUiAssetsServed() {
        TestRestTemplate client = new TestRestTemplate();
        ResponseEntity<String> resp = client.getForEntity(ADMIN_BASE + "/index.html", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("<div id=\"app\">");
    }
}
