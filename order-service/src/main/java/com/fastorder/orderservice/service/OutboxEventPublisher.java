package com.fastorder.orderservice.service;

import com.fastorder.orderservice.entity.OutboxEvent;
import com.fastorder.orderservice.repository.OutboxEventRepository;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.amqp.core.ReturnedMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.orders.processing-mode", havingValue = "event", matchIfMissing = true)
public class OutboxEventPublisher {

    private static final Logger logger = LoggerFactory.getLogger(OutboxEventPublisher.class);

    private final OutboxEventRepository outboxEventRepository;
    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;
    private final int batchSize;
    private final long publisherConfirmTimeoutMs;

    public OutboxEventPublisher(
            OutboxEventRepository outboxEventRepository,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbit.exchange}") String exchange,
            @Value("${app.rabbit.routing-key}") String routingKey,
            @Value("${app.orders.outbox-publisher-batch-size:100}") int batchSize,
            @Value("${app.orders.outbox-publisher-confirm-timeout-ms:5000}") long publisherConfirmTimeoutMs) {
        this.outboxEventRepository = outboxEventRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
        this.batchSize = batchSize;
        this.publisherConfirmTimeoutMs = publisherConfirmTimeoutMs;
        this.rabbitTemplate.setMandatory(true);
    }

    @Scheduled(fixedDelayString = "${app.orders.outbox-publisher-delay-ms:500}")
    public void publishPendingEvents() {
        List<OutboxEvent> events = outboxEventRepository.findByProcessedFalseOrderByCreatedAtAsc(
                PageRequest.of(0, batchSize));
        int published = 0;
        for (OutboxEvent event : events) {
            if (publish(event)) {
                published++;
            }
        }

        if (published > 0) {
            outboxEventRepository.saveAll(events.stream()
                    .filter(OutboxEvent::getProcessed)
                    .toList());
            logger.info("Lote outbox publicado count={}, requestedBatch={}", published, events.size());
        }
    }

    private boolean publish(OutboxEvent event) {
        try {
            CorrelationData correlationData = new CorrelationData(
                    "outbox-" + event.getId() + "-" + UUID.randomUUID());
            rabbitTemplate.convertAndSend(exchange, routingKey, event.getPayload(), correlationData);
            CorrelationData.Confirm confirm = correlationData.getFuture()
                    .get(publisherConfirmTimeoutMs, TimeUnit.MILLISECONDS);

            if (!confirm.isAck()) {
                logger.error("RabbitMQ no confirmo evento outbox eventId={}, reason={}",
                        event.getId(), confirm.getReason());
                return false;
            }

            ReturnedMessage returned = correlationData.getReturned();
            if (returned != null) {
                logger.error(
                        "RabbitMQ devolvio evento outbox no enrutable eventId={}, exchange={}, routingKey={}, replyText={}",
                        event.getId(), returned.getExchange(), returned.getRoutingKey(), returned.getReplyText());
                return false;
            }

            event.setProcessed(true);
            logger.debug("Evento outbox publicado eventId={}, type={}, aggregateId={}",
                    event.getId(), event.getEventType(), event.getAggregateId());
            return true;
        } catch (TimeoutException exception) {
            logger.error("Timeout esperando confirmacion RabbitMQ para outbox eventId={}", event.getId(), exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            logger.error("Publicacion de outbox interrumpida eventId={}", event.getId(), exception);
        } catch (ExecutionException exception) {
            logger.error("RabbitMQ fallo confirmando outbox eventId={}", event.getId(), exception);
        } catch (RuntimeException exception) {
            logger.error("No se pudo publicar evento outbox eventId={}", event.getId(), exception);
        }
        return false;
    }
}
