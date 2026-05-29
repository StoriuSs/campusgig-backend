import { Inject } from '@nestjs/common'
import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { ThreadReadEvent } from '../../../domain/events'
import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort } from '../../../domain/ports'
import { SocketEmitter } from './socket-emitter.service'

@EventsHandler(ThreadReadEvent)
export class ThreadReadSocketHandler implements IEventHandler<ThreadReadEvent> {
    constructor(
        private readonly emitter: SocketEmitter,
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    async handle(event: ThreadReadEvent): Promise<void> {
        // Tell the OTHER party that their sent messages have been read so
        // their bubbles can flip the receipt to "double-check".
        this.emitter.emitToUser(event.otherUserId, 'thread:read', {
            threadId: event.threadId,
            readerId: event.viewerId,
            lastReadAt: event.lastReadAt.toISOString()
        })

        // Update the viewer's own unread count across all their open tabs.
        const count = await this.repo.getUnreadCount(event.viewerId)
        this.emitter.emitToUser(event.viewerId, 'unread:count', { count })
    }
}
