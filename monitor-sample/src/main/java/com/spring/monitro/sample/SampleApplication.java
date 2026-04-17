package com.spring.monitro.sample;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@SpringBootApplication
public class SampleApplication {

    public static void main(String[] args) {
        SpringApplication.run(SampleApplication.class, args);
    }

    @RestController
    static class DemoController {
        @GetMapping("/")
        public Map<String, String> index() {
            return Map.of(
                    "app", "spring-monitro-sample",
                    "admin", "http://localhost:8090/monitro/api/ping"
            );
        }
    }
}
