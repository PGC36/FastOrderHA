package com.fastorder.orderservice.service;

import com.fastorder.orderservice.entity.OutboxEvent;
import com.fastorder.orderservice.repository.OutboxEventRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OutboxEventPublisher {

    private static final Logger logger = LoggerFactory.getLogger(OutboxEventPublisher.class);

    private final OutboxEventRepository outboxEventRepository;
    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;

    public OutboxEventPublisher(
            OutboxEventRepository outboxEventRepository,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbit.exchange}") String exchange,
            @Value("${app.rabbit.routing-key}") String routingKey) {
        this.outboxEventRepository = outboxEventRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    @Scheduled(fixedDelayString = "${app.orders.outbox-publisher-delay-ms:500}")
    public void publishPendingEvents() {
        List<OutboxEvent> events = outboxEventRepository.findTop100ByProcessedFalseOrderByCreatedAtAsc();
        for (OutboxEvent event : events) {
            publish(event);
        }
    }

    private void publish(OutboxEvent event) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event.getPayload());
            event.setProcessed(true);
            outboxEventRepository.save(event);
            logger.info("Evento outbox publicado eventId={}, type={}, aggregateId={}",
                    event.getId(), event.getEventType(), event.getAggregateId());
        } catch (RuntimeException exception) {
            logger.error("No se pudo publicar evento outbox eventId={}", event.getId(), exception);
        }
    }
}
