import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job } from 'bullmq'

import { EmailService } from '@/shared/infrastructure/email'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../domain/ports/notification.repository.port'
import { NotificationData, NotificationType } from '../../domain/notification.types'
import { notificationPath, renderNotificationEmail } from '../notification-render'
import { NOTIFICATION_EMAIL_QUEUE } from './notification-email.queue'

interface NotificationEmailJob {
    notificationId: string
    recipientId: string
    type: NotificationType
    data: NotificationData
}

@Processor(NOTIFICATION_EMAIL_QUEUE)
export class NotificationEmailConsumer extends WorkerHost {
    private readonly logger = new Logger(NotificationEmailConsumer.name)

    constructor(
        @Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort,
        private readonly emailService: EmailService,
        private readonly config: ConfigService
    ) {
        super()
    }

    async process(job: Job<NotificationEmailJob, void, string>): Promise<void> {
        const { notificationId, recipientId, type, data } = job.data
        this.logger.log(`Processing notification-email job ${job.id} → type=${type} notificationId=${notificationId}`)
        const email = await this.repo.findRecipientEmail(recipientId)
        if (!email) {
            this.logger.warn(`No email for recipient ${recipientId}; skipping notification email ${notificationId}`)
            return
        }

        const { subject, heading, body, ctaLabel } = renderNotificationEmail(type, data)
        const frontendUrl = (this.config.get<string>('app.frontendUrl') ?? '').replace(/\/+$/, '')
        const appName = this.config.get<string>('app.name') ?? 'CampusGig'

        await this.emailService.sendEmail(email, subject, './notification', {
            appName,
            heading,
            body,
            ctaLabel,
            ctaUrl: `${frontendUrl}${notificationPath(type, data)}`,
            year: new Date().getFullYear()
        })
        await this.repo.markEmailSent(notificationId)
    }
}
