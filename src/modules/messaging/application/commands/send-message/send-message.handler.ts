import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort, MessageItem } from '../../../domain/ports'
import {
    EmptyMessageException,
    NotAThreadParticipantException,
    TooManyAttachmentsException
} from '../../../domain/exceptions'
import { MessageSentEvent, ThreadReadEvent } from '../../../domain/events'
import { SendMessageCommand } from './send-message.command'

const MAX_ATTACHMENTS_PER_MESSAGE = 5

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: SendMessageCommand): Promise<MessageItem> {
        const body = command.body?.trim() || null
        const attachmentIds = command.attachmentIds ?? []

        if (!body && attachmentIds.length === 0) {
            throw new EmptyMessageException()
        }
        if (attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
            throw new TooManyAttachmentsException(attachmentIds.length, MAX_ATTACHMENTS_PER_MESSAGE)
        }

        const thread = await this.repo.getThreadById(command.threadId, command.senderId)
        if (!thread) {
            throw new NotAThreadParticipantException(command.threadId, command.senderId)
        }

        const message = await this.repo.insertMessage({
            threadId: command.threadId,
            senderId: command.senderId,
            body,
            orderId: command.orderId,
            attachmentIds
        })

        this.eventBus.publish(new MessageSentEvent(command.threadId, message, thread.otherUserId))

        // Replying to a message is implicit confirmation that the sender has
        // read everything before it. Move the cursor so the peer's bubbles
        // flip to "read" (double-check) without waiting for an explicit open
        // event. Fire-and-forget so a failure here can't fail the send.
        try {
            const result = await this.repo.markThreadRead(command.threadId, command.senderId)
            this.eventBus.publish(
                new ThreadReadEvent(
                    command.threadId,
                    command.senderId,
                    thread.otherUserId,
                    result.lastReadAt,
                    result.unreadCleared
                )
            )
        } catch {
            /* non-fatal — the explicit Mark Read path still works */
        }

        return message
    }
}
