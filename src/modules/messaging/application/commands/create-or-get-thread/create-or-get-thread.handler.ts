import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort } from '../../../domain/ports'
import { CannotMessageSelfException } from '../../../domain/exceptions'
import { CreateOrGetThreadCommand } from './create-or-get-thread.command'

@CommandHandler(CreateOrGetThreadCommand)
export class CreateOrGetThreadHandler implements ICommandHandler<CreateOrGetThreadCommand> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    async execute(command: CreateOrGetThreadCommand): Promise<{ threadId: string }> {
        if (command.viewerId === command.otherUserId) {
            throw new CannotMessageSelfException(command.viewerId)
        }

        const { id } = await this.repo.createOrGetThread(command.viewerId, command.otherUserId)
        return { threadId: id }
    }
}
