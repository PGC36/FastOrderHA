package com.example.inventory_service.config;

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

@Configuration
public class RabbitConfig {

    @Bean
    public DirectExchange fastorderDeadLetterExchange(
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String exchangeName) {
        return new DirectExchange(exchangeName, true, false);
    }

    @Bean
    public TopicExchange inventoryExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue inventoryQueue(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue inventoryDlq(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding inventoryDlqBinding(
            Queue inventoryDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.queue}") String queueName) {
        return BindingBuilder.bind(inventoryDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding inventoryBinding(
            Queue inventoryQueue,
            TopicExchange inventoryExchange,
            @Value("${app.rabbit.routing-key}") String routingKey) {
        return BindingBuilder.bind(inventoryQueue).to(inventoryExchange).with(routingKey);
    }

    @Bean
    public TopicExchange orderExchange(
            @Value("${app.rabbit.order-exchange:order.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue inventoryOrderCreatedQueue(
            @Value("${app.rabbit.order-created-queue:inventory.order-created.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue inventoryOrderCreatedDlq(
            @Value("${app.rabbit.order-created-queue:inventory.order-created.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding inventoryOrderCreatedDlqBinding(
            Queue inventoryOrderCreatedDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.order-created-queue:inventory.order-created.queue}") String queueName) {
        return BindingBuilder.bind(inventoryOrderCreatedDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding inventoryOrderCreatedBinding(
            Queue inventoryOrderCreatedQueue,
            TopicExchange orderExchange,
            @Value("${app.rabbit.order-created-routing-key:order.event}") String routingKey) {
        return BindingBuilder.bind(inventoryOrderCreatedQueue).to(orderExchange).with(routingKey);
    }

    @Bean
    public TopicExchange deliveryExchange(
            @Value("${app.rabbit.delivery-exchange:delivery.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue inventoryDeliveryCompletedQueue(
            @Value("${app.rabbit.delivery-completed-queue:inventory.delivery-completed.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue inventoryDeliveryCompletedDlq(
            @Value("${app.rabbit.delivery-completed-queue:inventory.delivery-completed.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding inventoryDeliveryCompletedDlqBinding(
            Queue inventoryDeliveryCompletedDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.delivery-completed-queue:inventory.delivery-completed.queue}") String queueName) {
        return BindingBuilder.bind(inventoryDeliveryCompletedDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding inventoryDeliveryCompletedBinding(
            Queue inventoryDeliveryCompletedQueue,
            TopicExchange deliveryExchange,
            @Value("${app.rabbit.delivery-completed-routing-key:delivery.completed}") String routingKey) {
        return BindingBuilder.bind(inventoryDeliveryCompletedQueue).to(deliveryExchange).with(routingKey);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
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
