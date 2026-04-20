package com.spring.monitro.core.model;

import java.time.Instant;

public class SnapshotData {

    private final Instant timestamp;
    private final Double heapUsed;
    private final Double heapMax;
    private final Double heapCommitted;
    private final Double threadsLive;
    private final Double threadsDaemon;
    private final Double threadsPeak;
    private final Double cpuProcess;
    private final Double cpuSystem;

    public SnapshotData(Instant timestamp,
                        Double heapUsed, Double heapMax, Double heapCommitted,
                        Double threadsLive, Double threadsDaemon, Double threadsPeak,
                        Double cpuProcess, Double cpuSystem) {
        this.timestamp      = timestamp;
        this.heapUsed       = heapUsed;
        this.heapMax        = heapMax;
        this.heapCommitted  = heapCommitted;
        this.threadsLive    = threadsLive;
        this.threadsDaemon  = threadsDaemon;
        this.threadsPeak    = threadsPeak;
        this.cpuProcess     = cpuProcess;
        this.cpuSystem      = cpuSystem;
    }

    public Instant getTimestamp()      { return timestamp; }
    public Double  getHeapUsed()       { return heapUsed; }
    public Double  getHeapMax()        { return heapMax; }
    public Double  getHeapCommitted()  { return heapCommitted; }
    public Double  getThreadsLive()    { return threadsLive; }
    public Double  getThreadsDaemon()  { return threadsDaemon; }
    public Double  getThreadsPeak()    { return threadsPeak; }
    public Double  getCpuProcess()     { return cpuProcess; }
    public Double  getCpuSystem()      { return cpuSystem; }
}
