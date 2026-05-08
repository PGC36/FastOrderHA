package com.example.demo.messaging;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    @Value("${app.rabbit.exchange}")
    private String exchange;

    @Value("${app.rabbit.routing-key}")
    private String routingKey;

    public void publishNotificationCreated(NotificationCreatedEvent event) {
        rabbitTemplate.convertAndSend(exchange, routingKey, event);
        log.info("Notification event published. exchange={}, routingKey={}, notificationId={}",
                exchange, routingKey, event.notificationId());
    }
}
