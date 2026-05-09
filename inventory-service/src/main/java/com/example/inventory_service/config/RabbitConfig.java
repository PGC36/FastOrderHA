package com.example.inventory_service.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
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
    public TopicExchange inventoryExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue inventoryQueue(@Value("${app.rabbit.queue}") String queueName) {
        return QueueBuilder.durable(queueName).build();
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
            @Value("${app.rabbit.order-created-queue:inventory.order-created.queue}") String queueName) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    public Binding inventoryOrderCreatedBinding(
            Queue inventoryOrderCreatedQueue,
            TopicExchange orderExchange,
            @Value("${app.rabbit.order-created-routing-key:order.event}") String routingKey) {
        return BindingBuilder.bind(inventoryOrderCreatedQueue).to(orderExchange).with(routingKey);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
