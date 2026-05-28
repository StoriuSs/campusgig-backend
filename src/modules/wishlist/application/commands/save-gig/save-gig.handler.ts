import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { SaveGigCommand } from './save-gig.command'
import { WishlistRepositoryPort, WISHLIST_REPOSITORY_PORT } from '../../../domain/ports/wishlist.repository.port'

@CommandHandler(SaveGigCommand)
export class SaveGigHandler implements ICommandHandler<SaveGigCommand> {
    constructor(@Inject(WISHLIST_REPOSITORY_PORT) private readonly repo: WishlistRepositoryPort) {}

    async execute(command: SaveGigCommand): Promise<void> {
        await this.repo.save(command.userId, command.gigId)
    }
}
