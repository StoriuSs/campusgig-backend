import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { MarkReadCommand } from './mark-read.command'

@CommandHandler(MarkReadCommand)
export class MarkReadHandler implements ICommandHandler<MarkReadCommand> {
    constructor(@Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort) {}

    execute(command: MarkReadCommand): Promise<void> {
        return this.repo.markRead(command.id, command.recipientId)
    }
}
