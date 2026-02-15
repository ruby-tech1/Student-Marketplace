import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigInterface } from 'src/config-module/configuration';
import { MyLoggerService } from '../logger/my-logger.service';
import * as amqplib from 'amqplib';

export interface QueueConfig {
    name: string;
    routingKey: string;
    handler: (data: any) => Promise<void> | void;
}

export interface RabbitMQConfig {
    queues: QueueConfig[];
    retryExchange: string;
    queueExchange: string;
    deadLetterExchange: string;
    maxRetryAttempt: number;
    retryDelayMs: number;
}

@Injectable()
export class RabbitMQService implements OnModuleInit {
    private rabbitMQConfig: RabbitMQConfig = {
        queues: [],
        retryExchange: 'studentMarketplaceRetryExchange',
        queueExchange: 'studentMarketplaceQueueExchange',
        deadLetterExchange: 'studentMarketplaceDeadLetterQueue',
        maxRetryAttempt: 5,
        retryDelayMs: 10000,
    };

    private readonly logger: MyLoggerService = new MyLoggerService(
        RabbitMQService.name,
    );
    private channel: any; // amqplib.Channel;
    private connection: any; // amqplib.Connection;

    constructor(private readonly configService: ConfigService<ConfigInterface>) { }

    async onModuleInit() {
        const maxRetries = 5;
        const retryDelayMs = 3000; // 3 seconds
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                const uri = this.configService.get('queue.rabbitMQUri', { infer: true });
                if (!uri) throw new Error('RabbitMQ URI not configured');

                this.connection = await amqplib.connect(uri);
                this.channel = await this.connection.createChannel();

                await this.channel.assertExchange(
                    this.rabbitMQConfig.queueExchange,
                    'topic',
                    { durable: true },
                );
                await this.channel.assertExchange(
                    this.rabbitMQConfig.retryExchange,
                    'topic',
                    { durable: true },
                );
                await this.channel.assertExchange(
                    this.rabbitMQConfig.deadLetterExchange,
                    'topic',
                    { durable: true },
                );

                for (const queue of this.rabbitMQConfig.queues) {
                    await this.configureQueue(queue);
                    await this.consumeQueue(queue.name, queue.routingKey, queue.handler);
                }

                this.logger.log(
                    'RabbitMQ connected and queues configured',
                    RabbitMQService.name,
                );
                break;
            } catch (error) {
                attempts++;
                this.logger.error(
                    `Failed to configure RabbitMQ queues (attempt ${attempts}/${maxRetries}): ${error.message}`,
                    RabbitMQService.name,
                );

                if (attempts >= maxRetries) {
                    // Instead of crashing, maybe just log error? But for now throw error as per reference
                    // throw new Error(
                    //   'Failed to connect to RabbitMQ after several attempts',
                    // );
                    // Reverting to just log error to allow app to start even if RabbitMQ is down (dev friendly)
                    this.logger.error('Giving up on RabbitMQ connection. Email service will fail.');
                    return;
                }

                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            }
        }
    }

    private async configureQueue(queue: QueueConfig): Promise<void> {
        const { name, routingKey }: QueueConfig = queue;
        const queueName = `${name}_nest_queue`;
        const retryQueueName = `${name}_nest_retry_queue`;
        const deadLetterQueueName = `${name}_dead_letter_queue`;

        await this.channel.assertQueue(queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': this.rabbitMQConfig.retryExchange,
                'x-dead-letter-routing-key': routingKey,
            },
        });

        await this.channel.assertQueue(retryQueueName, {
            durable: true,
            arguments: {
                'x-message-ttl': this.rabbitMQConfig.retryDelayMs,
                'x-dead-letter-exchange': this.rabbitMQConfig.queueExchange,
                'x-dead-letter-routing-key': routingKey,
            },
        });

        await this.channel.assertQueue(deadLetterQueueName, {
            durable: true,
        });

        await this.channel.bindQueue(
            queueName,
            this.rabbitMQConfig.queueExchange,
            routingKey,
        );

        await this.channel.bindQueue(
            retryQueueName,
            this.rabbitMQConfig.retryExchange,
            routingKey,
        );

        await this.channel.bindQueue(
            deadLetterQueueName,
            this.rabbitMQConfig.deadLetterExchange,
            routingKey,
        );
    }

    async addQueue(config: QueueConfig): Promise<void> {
        this.rabbitMQConfig.queues.push(config);
        // If the channel is already initialised (onModuleInit already ran),
        // configure and start consuming immediately.
        if (this.channel) {
            await this.configureQueue(config);
            await this.consumeQueue(config.name, config.routingKey, config.handler);
        }
    }

    async addToQueue(routingKey: string, data: any) {
        if (!this.channel) {
            this.logger.warn('RabbitMQ channel not initialized, message lost', RabbitMQService.name);
            return false;
        }
        try {
            this.channel.publish(
                this.rabbitMQConfig.queueExchange,
                routingKey,
                Buffer.from(JSON.stringify(data)),
            );
            this.logger.log(`Queue message request published`, RabbitMQService.name);
            return true;
        } catch (error) {
            this.logger.error(
                `Failed to publish queue message: ${error.message}`,
                RabbitMQService.name,
            );
            throw error;
        }
    }

    private async consumeQueue(
        queueName: string,
        routingKey: string,
        callback: (data: any) => Promise<void> | void,
    ) {
        await this.channel.consume(
            `${queueName}_nest_queue`,
            async (msg) => {
                if (!msg) return;

                try {
                    const data = JSON.parse(msg.content.toString());
                    this.logger.log(`Processing queue message`, RabbitMQService.name);

                    await callback(data);
                    this.channel.ack(msg);
                    this.logger.log(
                        `Queue message processed successfully`,
                        RabbitMQService.name,
                    );
                } catch (error) {
                    let retryCount = 0;
                    const xDeath: amqplib.XDeath[] | undefined =
                        msg.properties.headers?.['x-death'];
                    if (xDeath && xDeath.length > 0) {
                        retryCount = xDeath[0].count;
                    }

                    if (retryCount < this.rabbitMQConfig.maxRetryAttempt) {
                        this.channel.reject(msg, false);
                        this.logger.warn(
                            `Queue message processing failed, sending to retry queue. Attempt ${retryCount + 1} of ${this.rabbitMQConfig.maxRetryAttempt}`,
                            RabbitMQService.name,
                        );
                    } else {
                        this.channel.ack(msg);
                        this.logger.error(
                            `Max retries reached for queue message, sending to dead letter queue: ${error.message}`,
                            RabbitMQService.name,
                        );

                        this.channel.publish(
                            this.rabbitMQConfig.deadLetterExchange,
                            routingKey,
                            msg.content,
                            {
                                persistent: true,
                                headers: msg.properties.headers,
                            },
                        );
                    }
                }
            },
            { noAck: false },
        );

        this.logger.log('Queue consumer started', RabbitMQService.name);
    }
}
