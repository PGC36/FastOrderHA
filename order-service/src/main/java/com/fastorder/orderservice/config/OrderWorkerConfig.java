package com.fastorder.orderservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class OrderWorkerConfig {

    @Bean
    public ThreadPoolTaskExecutor orderWorkflowExecutor(
            @Value("${app.orders.workflow-worker-core-size:10}") int coreSize,
            @Value("${app.orders.workflow-worker-max-size:20}") int maxSize,
            @Value("${app.orders.workflow-worker-queue-capacity:1000}") int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("order-workflow-");
        executor.setCorePoolSize(coreSize);
        executor.setMaxPoolSize(maxSize);
        executor.setQueueCapacity(queueCapacity);
        executor.initialize();
        return executor;
    }
}
