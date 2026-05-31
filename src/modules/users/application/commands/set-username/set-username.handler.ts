import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { SetUsernameCommand } from './set-username.command'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'
import { UserNotFoundException, UsernameAlreadySetException, UsernameTakenException } from '@/modules/users/domain'
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event'
import { UserEntity } from '@/modules/users/domain'
import { isReservedSystemUsername } from '@/shared/constants/platform'

@CommandHandler(SetUsernameCommand)
export class SetUsernameHandler implements ICommandHandler<SetUsernameCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: SetUsernameCommand): Promise<UserEntity> {
        const user = await this.userRepo.findById(command.userId)
        if (!user) {
            throw new UserNotFoundException(command.userId)
        }

        if (user.hasSetUsername) {
            throw new UsernameAlreadySetException()
        }

        // Reserved sentinels surface as "taken" — effect is identical to the user.
        if (isReservedSystemUsername(command.username)) {
            throw new UsernameTakenException(command.username)
        }

        const updatedUser = await this.userRepo.update(command.userId, {
            username: command.username,
            hasSetUsername: true
        })

        this.eventBus.publish(new UserProfileUpdatedEvent(updatedUser.id, updatedUser.keycloakId))

        return updatedUser
    }
}
