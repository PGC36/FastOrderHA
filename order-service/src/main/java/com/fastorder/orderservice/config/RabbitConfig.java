package com.fastorder.orderservice.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
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
            @Value("${app.rabbit.inventory-rejected-queue:order.inventory-rejected.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue orderInventoryRejectedDlq(
            @Value("${app.rabbit.inventory-rejected-queue:order.inventory-rejected.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding orderInventoryRejectedDlqBinding(
            Queue orderInventoryRejectedDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.inventory-rejected-queue:order.inventory-rejected.queue}") String queueName) {
        return BindingBuilder.bind(orderInventoryRejectedDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding orderInventoryRejectedBinding(
            Queue orderInventoryRejectedQueue,
            TopicExchange inventoryExchange,
            @Value("${app.rabbit.inventory-rejected-routing-key:inventory.rejected}") String routingKey) {
        return BindingBuilder.bind(orderInventoryRejectedQueue).to(inventoryExchange).with(routingKey);
    }

    @Bean
    public TopicExchange kitchenExchange(
            @Value("${app.rabbit.kitchen-exchange:kitchen.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue orderKitchenFailedQueue(
            @Value("${app.rabbit.kitchen-failed-queue:order.kitchen-failed.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue orderKitchenFailedDlq(
            @Value("${app.rabbit.kitchen-failed-queue:order.kitchen-failed.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding orderKitchenFailedDlqBinding(
            Queue orderKitchenFailedDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.kitchen-failed-queue:order.kitchen-failed.queue}") String queueName) {
        return BindingBuilder.bind(orderKitchenFailedDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
    }

    @Bean
    public Binding orderKitchenFailedBinding(
            Queue orderKitchenFailedQueue,
            TopicExchange kitchenExchange,
            @Value("${app.rabbit.kitchen-failed-routing-key:kitchen.failed}") String routingKey) {
        return BindingBuilder.bind(orderKitchenFailedQueue).to(kitchenExchange).with(routingKey);
    }

    @Bean
    public TopicExchange deliveryExchange(
            @Value("${app.rabbit.delivery-exchange:delivery.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue orderDeliveryCompletedQueue(
            @Value("${app.rabbit.delivery-completed-queue:order.delivery-completed.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue orderDeliveryCompletedDlq(
            @Value("${app.rabbit.delivery-completed-queue:order.delivery-completed.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding orderDeliveryCompletedDlqBinding(
            Queue orderDeliveryCompletedDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.delivery-completed-queue:order.delivery-completed.queue}") String queueName) {
        return BindingBuilder.bind(orderDeliveryCompletedDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
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
            @Value("${app.rabbit.delivery-failed-queue:order.delivery-failed.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueueWithDlq(queueName, deadLetterExchange, queueType);
    }

    @Bean
    public Queue orderDeliveryFailedDlq(
            @Value("${app.rabbit.delivery-failed-queue:order.delivery-failed.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType);
    }

    @Bean
    public Binding orderDeliveryFailedDlqBinding(
            Queue orderDeliveryFailedDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.delivery-failed-queue:order.delivery-failed.queue}") String queueName) {
        return BindingBuilder.bind(orderDeliveryFailedDlq)
                .to(fastorderDeadLetterExchange)
                .with(dlqName(queueName));
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

    @Bean
    public Binding orderDeliveryFailedBinding(
            Queue orderDeliveryFailedQueue,
            TopicExchange deliveryExchange,
            @Value("${app.rabbit.delivery-failed-routing-key:delivery.failed}") String routingKey) {
        return BindingBuilder.bind(orderDeliveryFailedQueue).to(deliveryExchange).with(routingKey);
    }
}
