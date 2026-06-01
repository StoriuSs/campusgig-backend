import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { BadRequestException, Inject } from '@nestjs/common'

import { UserRepositoryPort, USER_REPOSITORY_PORT, UserNotFoundException, UserEntity } from '@/modules/users/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { EndorseUserCommand } from './endorse-user.command'
import { UserEndorsedEvent } from '../../events/user-endorsed.event'

@CommandHandler(EndorseUserCommand)
export class EndorseUserHandler implements ICommandHandler<EndorseUserCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: EndorseUserCommand): Promise<UserEntity> {
        const user = await this.userRepo.findById(command.userId)
        if (!user || user.isDeleted) {
            throw new UserNotFoundException(command.userId)
        }
        if (user.isEndorsed) {
            throw new BadRequestException('User is already endorsed.')
        }

        const updated = await this.userRepo.update(command.userId, {
            endorsedAt: new Date(),
            endorsedBy: command.adminId
        })

        await this.activityRepo.log({
            adminUserId: command.adminId,
            actionType: 'user_endorsed',
            targetType: 'user',
            targetId: updated.id,
            summary: updated.displayName ?? updated.username ?? 'a user'
        })
        this.eventBus.publish(new UserEndorsedEvent(updated.id, command.adminId))
        return updated
    }
}
