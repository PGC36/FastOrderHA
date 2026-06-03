package com.example.demo.config;

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
    public TopicExchange notificationExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue notificationQueue(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.dead-letter-exchange:fastorder.dlx}") String deadLetterExchange,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueue(queueName, deadLetterExchange, queueType)
                .build();
    }

    @Bean
    public Queue notificationDlq(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableDlq(queueName, queueType).build();
    }

    private QueueBuilder durableQueue(String queueName, String deadLetterExchange, String queueType) {
        QueueBuilder builder = QueueBuilder.durable(queueName)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(queueName + ".dlq");
        if ("quorum".equalsIgnoreCase(queueType)) {
            builder = builder.withArgument("x-queue-type", "quorum");
        }
        return builder;
    }

    private QueueBuilder durableDlq(String queueName, String queueType) {
        QueueBuilder builder = QueueBuilder.durable(queueName + ".dlq");
        if ("quorum".equalsIgnoreCase(queueType)) {
            builder = builder.withArgument("x-queue-type", "quorum");
        }
        return builder;
    }

    @Bean
    public Binding notificationDlqBinding(
            Queue notificationDlq,
            DirectExchange fastorderDeadLetterExchange,
            @Value("${app.rabbit.queue}") String queueName) {
        return BindingBuilder.bind(notificationDlq)
                .to(fastorderDeadLetterExchange)
                .with(queueName + ".dlq");
    }

    @Bean
    public Binding notificationBinding(
            Queue notificationQueue,
            TopicExchange notificationExchange,
            @Value("${app.rabbit.routing-key}") String routingKey) {
        return BindingBuilder.bind(notificationQueue).to(notificationExchange).with(routingKey);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
