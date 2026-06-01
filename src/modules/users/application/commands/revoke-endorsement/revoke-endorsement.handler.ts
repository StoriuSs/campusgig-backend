import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { BadRequestException, Inject } from '@nestjs/common'

import { UserRepositoryPort, USER_REPOSITORY_PORT, UserNotFoundException, UserEntity } from '@/modules/users/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { RevokeEndorsementCommand } from './revoke-endorsement.command'
import { EndorsementRevokedEvent } from '../../events/endorsement-revoked.event'

@CommandHandler(RevokeEndorsementCommand)
export class RevokeEndorsementHandler implements ICommandHandler<RevokeEndorsementCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RevokeEndorsementCommand): Promise<UserEntity> {
        const user = await this.userRepo.findById(command.userId)
        if (!user || user.isDeleted) {
            throw new UserNotFoundException(command.userId)
        }
        if (!user.isEndorsed) {
            throw new BadRequestException('User is not endorsed.')
        }

        const updated = await this.userRepo.update(command.userId, {
            endorsedAt: null,
            endorsedBy: null
        })

        await this.activityRepo.log({
            adminUserId: command.adminId,
            actionType: 'endorsement_revoked',
            targetType: 'user',
            targetId: updated.id,
            summary: updated.displayName ?? updated.username ?? 'a user'
        })
        this.eventBus.publish(new EndorsementRevokedEvent(updated.id, command.adminId))
        return updated
    }
}
