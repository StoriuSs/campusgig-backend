import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { SetUsernameCommand } from './set-username.command'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'
import { UserNotFoundException, UsernameAlreadySetException } from '@/modules/users/domain'
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event'
import { UserEntity } from '@/modules/users/domain'

@CommandHandler(SetUsernameCommand)
export class SetUsernameHandler implements ICommandHandler<SetUsernameCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: SetUsernameCommand): Promise<UserEntity> {
        // 1. Check if user exists
        const user = await this.userRepo.findById(command.userId)
        if (!user) {
            throw new UserNotFoundException(command.userId)
        }

        // 2. Check if username already set
        if (user.hasSetUsername) {
            throw new UsernameAlreadySetException()
        }

        // 3. Update username (repository throws UsernameTakenException on conflict)
        const updatedUser = await this.userRepo.update(command.userId, {
            username: command.username,
            hasSetUsername: true
        })

        // 4. Publish event for cache invalidation
        this.eventBus.publish(new UserProfileUpdatedEvent(updatedUser.id, updatedUser.keycloakId))

        return updatedUser
    }
}
