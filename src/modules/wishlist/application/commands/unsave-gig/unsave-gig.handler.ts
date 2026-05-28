import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { UnsaveGigCommand } from './unsave-gig.command'
import { WishlistRepositoryPort, WISHLIST_REPOSITORY_PORT } from '../../../domain/ports/wishlist.repository.port'

@CommandHandler(UnsaveGigCommand)
export class UnsaveGigHandler implements ICommandHandler<UnsaveGigCommand> {
    constructor(@Inject(WISHLIST_REPOSITORY_PORT) private readonly repo: WishlistRepositoryPort) {}

    async execute(command: UnsaveGigCommand): Promise<void> {
        await this.repo.unsave(command.userId, command.gigId)
    }
}
