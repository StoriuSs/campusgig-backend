import { Inject } from '@nestjs/common'
import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { MessageSentEvent } from '../../../domain/events'
import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort } from '../../../domain/ports'
import { SocketEmitter } from './socket-emitter.service'

@EventsHandler(MessageSentEvent)
export class MessageSentSocketHandler implements IEventHandler<MessageSentEvent> {
    constructor(
        private readonly emitter: SocketEmitter,
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    async handle(event: MessageSentEvent): Promise<void> {
        // Wire-shape: matches the frontend's MessageItem type. Attachments are
        // sent without presigned URLs (gateway has no avatar storage) — the
        // frontend resolves URLs lazily on click.
        const wirePayload = {
            threadId: event.threadId,
            message: {
                id: event.message.id,
                threadId: event.message.threadId,
                senderId: event.message.senderId,
                body: event.message.body,
                orderId: event.message.orderId,
                createdAt: event.message.createdAt.toISOString(),
                attachments: event.message.attachments.map((a) => ({
                    id: a.id,
                    name: a.name,
                    size: a.size,
                    mime: a.mime,
                    url: ''
                })),
                readByRecipient: event.message.readByRecipient
            }
        }

        // Send to everyone watching the thread (both participants if open) AND
        // separately to the recipient's user room so their sidebar reorders
        // even if the thread isn't currently open.
        this.emitter.emitToThread(event.threadId, 'message:new', wirePayload)
        this.emitter.emitToUser(event.recipientId, 'message:new', wirePayload)

        // Push an updated unread count to the recipient.
        const count = await this.repo.getUnreadCount(event.recipientId)
        this.emitter.emitToUser(event.recipientId, 'unread:count', { count })
    }
}
