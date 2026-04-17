package com.spring.monitro.core.model;

import java.util.List;

public class ThreadData {

    private final List<ThreadInfo> threads;

    public ThreadData(List<ThreadInfo> threads) {
        this.threads = threads;
    }

    public List<ThreadInfo> getThreads() { return threads; }

    public record ThreadInfo(
            long threadId,
            String threadName,
            String threadState,
            boolean daemon,
            int priority,
            List<String> stackTrace
    ) {}
}
