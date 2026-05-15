import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { DeleteAccountCommand } from './delete-account.command'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'
import { UserNotFoundException } from '@/modules/users/domain'
import { AccountDeletedEvent } from '@/modules/users/application'

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler implements ICommandHandler<DeleteAccountCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: DeleteAccountCommand): Promise<void> {
        // 1. Check if user exists
        const user = await this.userRepo.findById(command.userId)
        if (!user) {
            throw new UserNotFoundException(command.userId)
        }

        // 2. Soft delete locally
        await this.userRepo.update(command.userId, {
            deletedAt: new Date(),
            deletedBy: command.actorId || command.userId
        })

        // 3. Publish event — handlers will invalidate cache and enqueue Keycloak hard delete
        this.eventBus.publish(new AccountDeletedEvent(user.id, user.keycloakId))
    }
}
