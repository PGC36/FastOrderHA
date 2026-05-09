package com.fastorder.orderservice.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    @Bean
    public TopicExchange orderExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public TopicExchange inventoryExchange(
            @Value("${app.rabbit.inventory-exchange:inventory.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue orderInventoryRejectedQueue(
            @Value("${app.rabbit.inventory-rejected-queue:order.inventory-rejected.queue}") String queueName) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    public Binding orderInventoryRejectedBinding(
            Queue orderInventoryRejectedQueue,
            TopicExchange inventoryExchange,
            @Value("${app.rabbit.inventory-rejected-routing-key:inventory.rejected}") String routingKey) {
        return BindingBuilder.bind(orderInventoryRejectedQueue).to(inventoryExchange).with(routingKey);
    }

    @Bean
    public TopicExchange deliveryExchange(
            @Value("${app.rabbit.delivery-exchange:delivery.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue orderDeliveryCompletedQueue(
            @Value("${app.rabbit.delivery-completed-queue:order.delivery-completed.queue}") String queueName) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    public Binding orderDeliveryCompletedBinding(
            Queue orderDeliveryCompletedQueue,
            TopicExchange deliveryExchange,
            @Value("${app.rabbit.delivery-completed-routing-key:delivery.completed}") String routingKey) {
        return BindingBuilder.bind(orderDeliveryCompletedQueue).to(deliveryExchange).with(routingKey);
    }

    @Bean
    public Queue orderDeliveryFailedQueue(
            @Value("${app.rabbit.delivery-failed-queue:order.delivery-failed.queue}") String queueName) {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    public Binding orderDeliveryFailedBinding(
            Queue orderDeliveryFailedQueue,
            TopicExchange deliveryExchange,
            @Value("${app.rabbit.delivery-failed-routing-key:delivery.failed}") String routingKey) {
        return BindingBuilder.bind(orderDeliveryFailedQueue).to(deliveryExchange).with(routingKey);
    }
}
