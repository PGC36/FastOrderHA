package com.fastorder.kitchen.config;

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
import com.fasterxml.jackson.databind.ObjectMapper;

@Configuration
public class RabbitConfig {

    @Bean
    public TopicExchange kitchenExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue kitchenQueue(@Value("${app.rabbit.queue}") String queueName) {
        return QueueBuilder.durable(queueName).build();
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
            @Value("${app.rabbit.inventory-reserved-queue:kitchen.inventory-reserved.queue}") String queueName) {
        return QueueBuilder.durable(queueName).build();
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
}
