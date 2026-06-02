import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

import { SocketEmitter } from '@/modules/messaging/application/events/handlers'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../domain/ports/notification.repository.port'
import { isEmailType } from '../../domain/notification.types'
import { NOTIFICATION_EMAIL_QUEUE } from '../email/notification-email.queue'
import { CreateNotificationCommand } from './create-notification.command'

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler implements ICommandHandler<CreateNotificationCommand> {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort,
        private readonly socketEmitter: SocketEmitter,
        @InjectQueue(NOTIFICATION_EMAIL_QUEUE) private readonly emailQueue: Queue
    ) {}

    async execute(command: CreateNotificationCommand): Promise<void> {
        const sendEmail = isEmailType(command.type)

        for (const recipientId of command.recipientIds) {
            const row = await this.repo.create({ recipientId, type: command.type, data: command.data })
            const unreadCount = await this.repo.unreadCount(recipientId)

            // Socket payloads bypass the HTTP snake↔camel interceptors — emit camelCase.
            this.socketEmitter.emitToUser(recipientId, 'notification:new', {
                notification: {
                    id: row.id,
                    type: row.type,
                    data: row.data,
                    read: false,
                    createdAt: row.createdAt.toISOString()
                },
                unreadCount
            })

            if (sendEmail) {
                await this.emailQueue.add(
                    'send',
                    { notificationId: row.id, recipientId, type: command.type, data: command.data },
                    {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 5000 },
                        removeOnComplete: true,
                        removeOnFail: 100
                    }
                )
            }
        }
    }
}
