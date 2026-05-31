import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { RemovePortfolioItemCommand } from './remove-portfolio-item.command'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'
import { PortfolioItemDeletedEvent } from '../../events/portfolio-item-deleted.event'

@CommandHandler(RemovePortfolioItemCommand)
export class RemovePortfolioItemHandler implements ICommandHandler<RemovePortfolioItemCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RemovePortfolioItemCommand): Promise<void> {
        const deleted = await this.userRepo.removePortfolioItem(command.userId, command.itemId)

        this.eventBus.publish(new PortfolioItemDeletedEvent(command.userId, deleted.imageKey))
    }
}
