import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { DeleteCategoryCommand } from './delete-category.command'
import {
    CategoryRepositoryPort,
    CATEGORY_REPOSITORY_PORT,
    CategoryNotFoundException,
    CategoryHasGigsException,
    InvalidReassignTargetException
} from '@/modules/categories/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { CategoryDeletedEvent } from '../../events/category-deleted.event'

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<DeleteCategoryCommand> {
    constructor(
        @Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    private async logDeleted(command: DeleteCategoryCommand, name: string): Promise<void> {
        await this.activityRepo.log({
            adminUserId: command.actorId,
            actionType: 'category_deleted',
            targetType: 'category',
            targetId: command.id,
            summary: `"${name}"`,
            metadata: { reassignedTo: command.reassignTo ?? null }
        })
    }

    async execute(command: DeleteCategoryCommand): Promise<void> {
        const target = await this.categoryRepo.findById(command.id)
        if (!target) {
            throw new CategoryNotFoundException(command.id)
        }

        const gigCount = await this.categoryRepo.countGigsForCategory(command.id)

        if (gigCount === 0) {
            // No ACTIVE gigs — but soft-deleted gigs may still FK-reference the
            // category (kept alive for order history) and would block the hard
            // delete. Rehome any such leftovers to a fallback category first;
            // they're invisible, so no admin decision is needed.
            const fallbackId = await this.categoryRepo.findFallbackCategoryId(command.id)
            if (fallbackId) {
                await this.categoryRepo.bulkReassignGigs(command.id, fallbackId)
            }
            await this.categoryRepo.delete(command.id)
            await this.logDeleted(command, target.name)
            this.eventBus.publish(new CategoryDeletedEvent(command.id))
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
        await this.logDeleted(command, target.name)
        this.eventBus.publish(new CategoryDeletedEvent(command.id))
    }
}
