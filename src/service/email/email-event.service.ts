import { Injectable, OnModuleInit } from '@nestjs/common';
import { EmailService } from './email.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { EmailRequest } from '../../model/request/email-request.dto';
import { EmailType } from '../../model/enum/email-type.enum';

@Injectable()
export class EmailEvent implements OnModuleInit {
    private readonly emailQueue = 'studentMarketplaceEmail';
    private readonly emailRoutingKey = 'studentMarketplaceEmailRoutingKey';

    constructor(
        private readonly emailService: EmailService,
        private readonly rabbitService: RabbitMQService,
    ) { }

    async onModuleInit() {
        await this.setupQueue();
    }

    private async setupQueue(): Promise<void> {
        await this.rabbitService.addQueue({
            name: this.emailQueue,
            routingKey: this.emailRoutingKey,
            handler: async (emailRequest: EmailRequest): Promise<void> => {
                if (emailRequest.type === EmailType.ACCOUNTVERIFICATION) {
                    await this.emailService.sendAccountVerificationMail(emailRequest);
                } else if (emailRequest.type === EmailType.ACCOUNTREGISTRATION) {
                    await this.emailService.sendRegistrationNotificationMail(
                        emailRequest,
                    );
                } else if (emailRequest.type === EmailType.PASSWORDRESET) {
                    await this.emailService.sendResetPasswordNotificationMail(
                        emailRequest,
                    );
                }
                // Implement other types as needed
            },
        });
    }

    async sendEmailRequest(emailRequest: EmailRequest): Promise<void> {
        await this.rabbitService.addToQueue(this.emailRoutingKey, emailRequest);
    }
}
