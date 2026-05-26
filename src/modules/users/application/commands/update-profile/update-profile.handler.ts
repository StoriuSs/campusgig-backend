import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { UpdateProfileCommand } from './update-profile.command'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event'
import { UserEntity } from '@/modules/users/domain'

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: UpdateProfileCommand): Promise<UserEntity> {
        const updateData: Partial<UserEntity> = {}
        if (command.displayName !== undefined) updateData.displayName = command.displayName
        if (command.bio !== undefined) updateData.bio = command.bio
        if (command.location !== undefined) updateData.location = command.location
        if (command.roleLine !== undefined) updateData.roleLine = command.roleLine
        if (command.languages !== undefined) updateData.languages = command.languages

        // UsernameTakenException is thrown by the repository if unique constraint fails
        const user = await this.userRepo.update(command.userId, updateData)

        // Publish domain event — event handlers will invalidate cache
        this.eventBus.publish(new UserProfileUpdatedEvent(user.id, user.keycloakId))

        return user
    }
}
