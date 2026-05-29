import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { GigsModule } from '@/modules/gigs/gigs.module'
import { UploadModule } from '@/shared/infrastructure'
import { MESSAGING_REPOSITORY_PORT, MESSAGE_ATTACHMENT_STORAGE_PORT, PRESENCE_PORT } from './domain/ports'
import {
    CreateOrGetThreadHandler,
    SendMessageHandler,
    MarkThreadReadHandler,
    UploadAttachmentHandler,
    GetInboxConversationsHandler,
    GetThreadMessagesHandler,
    GetUnreadCountHandler,
    GetThreadFilesHandler,
    ResolveAttachmentUrlHandler,
    GetResponseTimeHandler
} from './application'
import {
    SocketEmitter,
    MessageSentSocketHandler,
    ThreadReadSocketHandler,
    PresenceChangedSocketHandler,
    InvalidateResponseTimeHandler
} from './application/events/handlers'
import { PrismaMessagingRepository } from './infrastructure/persistence/prisma-messaging.repository'
import { S3MessageAttachmentAdapter } from './infrastructure/storage/s3-message-attachment.adapter'
import { RedisPresenceAdapter } from './infrastructure/presence/redis-presence.adapter'
import { MessagesController } from './presentation/http/messages.controller'
import { MessagingDomainExceptionFilter } from './presentation/filters/messaging-domain-exception.filter'
import { MessagingGateway } from './presentation/ws/messaging.gateway'
import { WsTokenAuthenticator } from './presentation/ws/ws-token-authenticator.service'
import { APP_FILTER } from '@nestjs/core'

const CommandHandlers = [CreateOrGetThreadHandler, SendMessageHandler, MarkThreadReadHandler, UploadAttachmentHandler]

const QueryHandlers = [
    GetInboxConversationsHandler,
    GetThreadMessagesHandler,
    GetUnreadCountHandler,
    GetThreadFilesHandler,
    ResolveAttachmentUrlHandler,
    GetResponseTimeHandler
]

const EventHandlers = [
    MessageSentSocketHandler,
    ThreadReadSocketHandler,
    PresenceChangedSocketHandler,
    InvalidateResponseTimeHandler
]

@Module({
    // GigsModule is imported because the controller reuses GIG_STORAGE_PORT
    // to resolve avatar S3 keys to presigned URLs (same pattern as
    // AdminWithdrawalsController). UploadModule provides STORAGE_SERVICE for
    // the chat-attachment S3 adapter. CqrsModule wires command/query/event
    // buses.
    imports: [CqrsModule, GigsModule, UploadModule],
    controllers: [MessagesController],
    providers: [
        // Ports
        { provide: MESSAGING_REPOSITORY_PORT, useClass: PrismaMessagingRepository },
        { provide: MESSAGE_ATTACHMENT_STORAGE_PORT, useClass: S3MessageAttachmentAdapter },
        { provide: PRESENCE_PORT, useClass: RedisPresenceAdapter },
        // WS
        WsTokenAuthenticator,
        MessagingGateway,
        SocketEmitter,
        // Exception filter scoped to messaging routes
        { provide: APP_FILTER, useClass: MessagingDomainExceptionFilter },
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers
    ],
    // Repo port exported so F10/F11 (Order Workspace) can emit system events
    // through the same MessagingRepository.insertMessage path.
    exports: [MESSAGING_REPOSITORY_PORT]
})
export class MessagingModule {}
