package com.fastorder.delivery.config;

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
    public TopicExchange deliveryExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue deliveryQueue(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange) {
        return durableQueueWithDlq(queueName, deadLetterExchange);
    }

    @Bean
    public Queue deliveryDlq(@Value("${app.rabbit.queue}") String queueName) {
        return QueueBuilder.durable(dlqName(queueName)).build();
    }

    @Bean
    public Binding deliveryDlqBinding(
            Queue deliveryDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.queue}") String queueName) {
        return BindingBuilder.bind(deliveryDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding deliveryBinding(
            Queue deliveryQueue,
            TopicExchange deliveryExchange,
            @Value("${app.rabbit.routing-key}") String routingKey) {
        return BindingBuilder.bind(deliveryQueue).to(deliveryExchange).with(routingKey);
    }

    @Bean
    public TopicExchange kitchenExchange(
            @Value("${app.rabbit.kitchen-exchange:kitchen.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue deliveryKitchenReadyQueue(
            @Value("${app.rabbit.kitchen-ready-queue:delivery.kitchen-ready.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange) {
        return durableQueueWithDlq(queueName, deadLetterExchange);
    }

    @Bean
    public Queue deliveryKitchenReadyDlq(
            @Value("${app.rabbit.kitchen-ready-queue:delivery.kitchen-ready.queue}") String queueName) {
        return QueueBuilder.durable(dlqName(queueName)).build();
    }

    @Bean
    public Binding deliveryKitchenReadyDlqBinding(
            Queue deliveryKitchenReadyDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.kitchen-ready-queue:delivery.kitchen-ready.queue}") String queueName) {
        return BindingBuilder.bind(deliveryKitchenReadyDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding deliveryKitchenReadyBinding(
            Queue deliveryKitchenReadyQueue,
            TopicExchange kitchenExchange,
            @Value("${app.rabbit.kitchen-ready-routing-key:kitchen.ready}") String routingKey) {
        return BindingBuilder.bind(deliveryKitchenReadyQueue).to(kitchenExchange).with(routingKey);
    }

    @Bean
    public TopicExchange notificationExchange(
            @Value("${app.rabbit.notification-exchange:notification.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    private Queue durableQueueWithDlq(String queueName, String deadLetterExchange) {
        return QueueBuilder.durable(queueName)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(dlqName(queueName))
                .build();
    }

    private String dlqName(String queueName) {
        return queueName + ".dlq";
    }
}
