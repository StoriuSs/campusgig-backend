import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { UpdateCategoryCommand } from './update-category.command'
import {
    CategoryRepositoryPort,
    CATEGORY_REPOSITORY_PORT,
    CategoryEntity,
    CategoryNotFoundException,
    DuplicateCategoryNameException,
    InvalidCategoryIconException,
    isValidCategoryIcon
} from '@/modules/categories/domain'
import { CategoryUpdatedEvent } from '../../events/category-updated.event'

const MAX_NAME_LENGTH = 50
const MAX_DESCRIPTION_LENGTH = 200

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<UpdateCategoryCommand> {
    constructor(
        @Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: UpdateCategoryCommand): Promise<CategoryEntity> {
        const existing = await this.categoryRepo.findById(command.id)
        if (!existing) {
            throw new CategoryNotFoundException(command.id)
        }

        const patch: { name?: string; icon?: string; description?: string | null } = {}

        if (command.name !== undefined) {
            const trimmed = command.name.trim()
            if (trimmed.length === 0) {
                throw new BadRequestException('Category name is required.')
            }
            if (trimmed.length > MAX_NAME_LENGTH) {
                throw new BadRequestException(`Category name must be ${MAX_NAME_LENGTH} characters or fewer.`)
            }
            // Only check uniqueness if the name actually changed (case-insensitive).
            if (trimmed.toLowerCase() !== existing.name.toLowerCase()) {
                const conflict = await this.categoryRepo.findByNameInsensitive(trimmed)
                if (conflict && conflict.id !== command.id) {
                    throw new DuplicateCategoryNameException(trimmed)
                }
            }
            patch.name = trimmed
        }

        if (command.icon !== undefined) {
            if (!isValidCategoryIcon(command.icon)) {
                throw new InvalidCategoryIconException(command.icon)
            }
            patch.icon = command.icon
        }

        if (command.description !== undefined) {
            const desc = command.description?.trim() || null
            if (desc !== null && desc.length > MAX_DESCRIPTION_LENGTH) {
                throw new BadRequestException(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`)
            }
            patch.description = desc
        }

        // Nothing actually to update — return existing.
        if (Object.keys(patch).length === 0) {
            return existing
        }

        const updated = await this.categoryRepo.update(command.id, patch)
        this.eventBus.publish(new CategoryUpdatedEvent(updated.id))
        return updated
    }
}
