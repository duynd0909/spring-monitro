package com.spring.monitro.core.collector;

/**
 * SPI for all data collectors. Implementations live in monitor-actuator and
 * wrap a specific Spring Actuator endpoint bean, collecting data in-process.
 */
public interface MonitorDataCollector<T> {

    String getId();

    CollectionResult<T> collect();
}
