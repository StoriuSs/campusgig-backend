import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { BullModule } from '@nestjs/bullmq'

import { EmailModule } from '@/shared/infrastructure/email'
import { MessagingModule } from '@/modules/messaging/messaging.module'

import { NOTIFICATION_REPOSITORY_PORT } from './domain'
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma-notification.repository'
import { CreateNotificationHandler } from './application/create-notification/create-notification.handler'
import { NotificationEmailConsumer } from './application/email/notification-email.consumer'
import { NOTIFICATION_EMAIL_QUEUE } from './application/email/notification-email.queue'
import {
    DisputeNotificationsHandler,
    GigNotificationsHandler,
    OrderNotificationsHandler,
    ReviewNotificationsHandler,
    UserNotificationsHandler,
    WalletNotificationsHandler
} from './application/events/handlers'
import { ListNotificationsHandler } from './application/queries/list-notifications/list-notifications.handler'
import { GetRecentNotificationsHandler } from './application/queries/get-recent-notifications/get-recent-notifications.handler'
import { GetUnreadCountHandler } from './application/queries/get-unread-count/get-unread-count.handler'
import { MarkReadHandler } from './application/commands/mark-read/mark-read.handler'
import { MarkAllReadHandler } from './application/commands/mark-all-read/mark-all-read.handler'
import { NotificationsController } from './presentation/http/notifications.controller'

const EventHandlers = [
    OrderNotificationsHandler,
    DisputeNotificationsHandler,
    ReviewNotificationsHandler,
    GigNotificationsHandler,
    WalletNotificationsHandler,
    UserNotificationsHandler
]

const QueryHandlers = [ListNotificationsHandler, GetRecentNotificationsHandler, GetUnreadCountHandler]
const CommandHandlers = [MarkReadHandler, MarkAllReadHandler]

// Imports only Messaging/Email/Bull/Cqrs — never the source feature modules. It
// consumes their event classes by identity through the shared EventBus, which
// avoids a DI cycle.
@Module({
    imports: [CqrsModule, MessagingModule, EmailModule, BullModule.registerQueue({ name: NOTIFICATION_EMAIL_QUEUE })],
    controllers: [NotificationsController],
    providers: [
        { provide: NOTIFICATION_REPOSITORY_PORT, useClass: PrismaNotificationRepository },
        CreateNotificationHandler,
        NotificationEmailConsumer,
        ...EventHandlers,
        ...QueryHandlers,
        ...CommandHandlers
    ],
    exports: [NOTIFICATION_REPOSITORY_PORT]
})
export class NotificationsModule {}
