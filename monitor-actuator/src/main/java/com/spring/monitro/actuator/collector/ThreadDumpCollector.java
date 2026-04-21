package com.spring.monitro.actuator.collector;

import com.spring.monitro.core.collector.CollectionResult;
import com.spring.monitro.core.collector.MonitorDataCollector;
import com.spring.monitro.core.model.ThreadData;
import org.springframework.boot.actuate.management.ThreadDumpEndpoint;

import java.util.Arrays;
import java.util.List;

public class ThreadDumpCollector implements MonitorDataCollector<ThreadData> {

    public static final String ID = "threaddump";

    private final ThreadDumpEndpoint threadDumpEndpoint;

    public ThreadDumpCollector(ThreadDumpEndpoint threadDumpEndpoint) {
        this.threadDumpEndpoint = threadDumpEndpoint;
    }

    @Override
    public String getId() { return ID; }

    @Override
    public CollectionResult<ThreadData> collect() {
        ThreadDumpEndpoint.ThreadDumpDescriptor descriptor = threadDumpEndpoint.threadDump();

        List<ThreadData.ThreadInfo> threads = descriptor.getThreads().stream()
                .map(t -> new ThreadData.ThreadInfo(
                        t.getThreadId(),
                        t.getThreadName(),
                        t.getThreadState().name(),
                        t.isDaemon(),
                        t.getPriority(),
                        Arrays.stream(t.getStackTrace())
                                .map(StackTraceElement::toString)
                                .limit(30)
                                .toList(),
                        t.getLockName(),
                        t.getLockOwnerId(),
                        t.getLockOwnerName(),
                        t.getBlockedCount(),
                        t.getWaitedCount()
                ))
                .toList();

        return CollectionResult.success(new ThreadData(threads));
    }
}
