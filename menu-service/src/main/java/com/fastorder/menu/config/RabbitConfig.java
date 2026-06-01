package com.fastorder.menu.config;

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
    public TopicExchange menuExchange(@Value("${app.rabbit.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue menuQueue(
            @Value("${app.rabbit.queue}") String queueName,
            @Value("${app.rabbit.queue-type:classic}") String queueType) {
        return durableQueue(queueName, queueType).build();
    }

    @Bean
    public Binding menuBinding(
            Queue menuQueue,
            TopicExchange menuExchange,
            @Value("${app.rabbit.routing-key}") String routingKey) {
        return BindingBuilder.bind(menuQueue).to(menuExchange).with(routingKey);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    private QueueBuilder durableQueue(String queueName, String queueType) {
        QueueBuilder builder = QueueBuilder.durable(queueName);
        if ("quorum".equalsIgnoreCase(queueType)) {
            builder = builder.withArgument("x-queue-type", "quorum");
        }
        return builder;
    }
}
