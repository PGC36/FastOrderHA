package com.fastorder.menu.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LoggingConfig {

    private static final Logger logger = LoggerFactory.getLogger(LoggingConfig.class);

    @PostConstruct
    void logStartupConfiguration() {
        logger.info("Logging configurado para menu-service. Use nivel DEBUG en com.fastorder.menu para trazabilidad detallada.");
    }
}
