import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { AddPortfolioItemCommand } from './add-portfolio-item.command'
import {
    UserRepositoryPort,
    USER_REPOSITORY_PORT,
    PortfolioItemEntity,
    MaxPortfolioItemsReachedException
} from '@/modules/users/domain'
import { StoragePort, STORAGE_PORT } from '../../ports'

const MAX_PORTFOLIO_ITEMS_PER_USER = 9

@CommandHandler(AddPortfolioItemCommand)
export class AddPortfolioItemHandler implements ICommandHandler<AddPortfolioItemCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        @Inject(STORAGE_PORT) private readonly storage: StoragePort
    ) {}

    async execute(command: AddPortfolioItemCommand): Promise<PortfolioItemEntity> {
        // Check cap before uploading to avoid wasting S3 bandwidth.
        const count = await this.userRepo.countPortfolioItems(command.userId)
        if (count >= MAX_PORTFOLIO_ITEMS_PER_USER) {
            throw new MaxPortfolioItemsReachedException()
        }

        const uploaded = await this.storage.uploadPortfolioItem(
            command.fileBuffer,
            command.originalName,
            command.userId
        )

        return this.userRepo.addPortfolioItem({
            userId: command.userId,
            imageKey: uploaded.key,
            width: uploaded.width ?? 0,
            height: uploaded.height ?? 0
        })
    }
}
