package com.spring.monitro.core.model;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

public class InfoData {

    private final String appName;
    private final Map<String, Object> build;
    private final Map<String, Object> git;
    private final Map<String, Object> extra;
    private final JvmInfo jvm;
    private final Instant startTime;
    private final String uptime;

    public InfoData(String appName, Map<String, Object> build, Map<String, Object> git,
                    Map<String, Object> extra, JvmInfo jvm, Instant startTime, String uptime) {
        this.appName = appName;
        this.build = build;
        this.git = git;
        this.extra = extra;
        this.jvm = jvm;
        this.startTime = startTime;
        this.uptime = uptime;
    }

    public String getAppName() { return appName; }
    public Map<String, Object> getBuild() { return build; }
    public Map<String, Object> getGit() { return git; }
    public Map<String, Object> getExtra() { return extra; }
    public JvmInfo getJvm() { return jvm; }
    public Instant getStartTime() { return startTime; }
    public String getUptime() { return uptime; }

    public record JvmInfo(String version, String vendor, String vmName) {}

    public static JvmInfo currentJvm() {
        Runtime rt = Runtime.getRuntime();
        return new JvmInfo(
                System.getProperty("java.version"),
                System.getProperty("java.vendor"),
                System.getProperty("java.vm.name")
        );
    }

    public static Instant processStartTime() {
        long startMs = ManagementFactory.getRuntimeMXBean().getStartTime();
        return Instant.ofEpochMilli(startMs);
    }

    public static String formatUptime(Instant startTime) {
        Duration d = Duration.between(startTime, Instant.now());
        long h = d.toHours();
        long m = d.toMinutesPart();
        long s = d.toSecondsPart();
        return String.format("%dh %dm %ds", h, m, s);
    }
}
