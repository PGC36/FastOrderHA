package com.fastorder.kitchen.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.fasterxml.jackson.databind.ObjectMapper;

@Configuration
public class RabbitConfig {

    @Bean
    public DirectExchange fastorderDeadLetterExchange(
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String exchangeName) {
        return new DirectExchange(exchangeName, true, false);
    }

    @Bean
    public TopicExchange kitchenExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue kitchenQueue(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue kitchenDlq(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding kitchenDlqBinding(
            Queue kitchenDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.queue}") String queueName) {
        return BindingBuilder.bind(kitchenDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding kitchenBinding(
            Queue kitchenQueue,
            TopicExchange kitchenExchange,
            @Value("${app.rabbit.routing-key}") String routingKey) {
        return BindingBuilder.bind(kitchenQueue).to(kitchenExchange).with(routingKey);
    }

    @Bean
    public TopicExchange inventoryExchange(
            @Value("${app.rabbit.inventory-exchange:inventory.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue kitchenInventoryReservedQueue(
            @Value("${app.rabbit.inventory-reserved-queue:kitchen.inventory-reserved.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue kitchenInventoryReservedDlq(
            @Value("${app.rabbit.inventory-reserved-queue:kitchen.inventory-reserved.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding kitchenInventoryReservedDlqBinding(
            Queue kitchenInventoryReservedDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.inventory-reserved-queue:kitchen.inventory-reserved.queue}") String queueName) {
        return BindingBuilder.bind(kitchenInventoryReservedDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding kitchenInventoryReservedBinding(
            Queue kitchenInventoryReservedQueue,
            TopicExchange inventoryExchange,
            @Value("${app.rabbit.inventory-reserved-routing-key:inventory.reserved}") String routingKey) {
        return BindingBuilder.bind(kitchenInventoryReservedQueue).to(inventoryExchange).with(routingKey);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    private Queue durableQueueWithDlq(String queueName, String deadLetterExchange, String queueType) {
        QueueBuilder builder = QueueBuilder.durable(queueName)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(dlqName(queueName));
        if ("quorum".equalsIgnoreCase(queueType)) {
            builder = builder.withArgument("x-queue-type", "quorum");
        }
        return builder.build();
    }

    private Queue durableDlq(String queueName, String queueType) {
        QueueBuilder builder = QueueBuilder.durable(dlqName(queueName));
        if ("quorum".equalsIgnoreCase(queueType)) {
            builder = builder.withArgument("x-queue-type", "quorum");
        }
        return builder.build();
    }

    private String dlqName(String queueName) {
        return queueName + ".dlq";
    }
}
