import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { DeleteCategoryCommand } from './delete-category.command'
import {
    CategoryRepositoryPort,
    CATEGORY_REPOSITORY_PORT,
    CategoryNotFoundException,
    CategoryHasGigsException,
    InvalidReassignTargetException
} from '@/modules/categories/domain'

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<DeleteCategoryCommand> {
    constructor(@Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort) {}

    async execute(command: DeleteCategoryCommand): Promise<void> {
        const target = await this.categoryRepo.findById(command.id)
        if (!target) {
            throw new CategoryNotFoundException(command.id)
        }

        const gigCount = await this.categoryRepo.countGigsForCategory(command.id)

        if (gigCount === 0) {
            // No gigs — simple delete. reassignTo is ignored.
            await this.categoryRepo.delete(command.id)
            return
        }

        // Has gigs — reassignTo is mandatory.
        if (!command.reassignTo) {
            throw new CategoryHasGigsException(command.id, gigCount)
        }

        if (command.reassignTo === command.id) {
            throw new InvalidReassignTargetException('self', command.reassignTo)
        }

        const target2 = await this.categoryRepo.findById(command.reassignTo)
        if (!target2) {
            throw new InvalidReassignTargetException('not-found', command.reassignTo)
        }

        await this.categoryRepo.bulkReassignGigs(command.id, command.reassignTo)
        await this.categoryRepo.delete(command.id)
    }
}
