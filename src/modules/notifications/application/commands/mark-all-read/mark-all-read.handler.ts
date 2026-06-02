import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { MarkAllReadCommand } from './mark-all-read.command'

@CommandHandler(MarkAllReadCommand)
export class MarkAllReadHandler implements ICommandHandler<MarkAllReadCommand> {
    constructor(@Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort) {}

    execute(command: MarkAllReadCommand): Promise<void> {
        return this.repo.markAllRead(command.recipientId)
    }
}
