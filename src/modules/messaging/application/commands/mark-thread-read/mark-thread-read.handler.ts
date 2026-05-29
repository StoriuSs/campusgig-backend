import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort } from '../../../domain/ports'
import { NotAThreadParticipantException } from '../../../domain/exceptions'
import { ThreadReadEvent } from '../../../domain/events'
import { MarkThreadReadCommand } from './mark-thread-read.command'

@CommandHandler(MarkThreadReadCommand)
export class MarkThreadReadHandler implements ICommandHandler<MarkThreadReadCommand> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: MarkThreadReadCommand): Promise<{ lastReadAt: Date; unreadCleared: number }> {
        const thread = await this.repo.getThreadById(command.threadId, command.viewerId)
        if (!thread) {
            throw new NotAThreadParticipantException(command.threadId, command.viewerId)
        }

        const result = await this.repo.markThreadRead(command.threadId, command.viewerId)

        // Always emit — the gateway uses the event to push a fresh unread count
        // to the viewer's tabs and to flip the sender's bubbles to "read" even
        // when unreadCleared is 0 (idempotent open with no new messages still
        // confirms the read state).
        this.eventBus.publish(
            new ThreadReadEvent(
                command.threadId,
                command.viewerId,
                thread.otherUserId,
                result.lastReadAt,
                result.unreadCleared
            )
        )

        return result
    }
}
