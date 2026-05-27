import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { CreateCategoryCommand } from './create-category.command'
import {
    CategoryRepositoryPort,
    CATEGORY_REPOSITORY_PORT,
    CategoryEntity,
    DuplicateCategoryNameException,
    InvalidCategoryIconException,
    isValidCategoryIcon
} from '@/modules/categories/domain'
import { CategoryCreatedEvent } from '../../events/category-created.event'

const MAX_NAME_LENGTH = 50
const MAX_DESCRIPTION_LENGTH = 200

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand> {
    constructor(
        @Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: CreateCategoryCommand): Promise<CategoryEntity> {
        const name = command.name.trim()
        if (name.length === 0) {
            throw new BadRequestException('Category name is required.')
        }
        if (name.length > MAX_NAME_LENGTH) {
            throw new BadRequestException(`Category name must be ${MAX_NAME_LENGTH} characters or fewer.`)
        }
        if (!isValidCategoryIcon(command.icon)) {
            throw new InvalidCategoryIconException(command.icon)
        }
        const description = command.description?.trim() || null
        if (description !== null && description.length > MAX_DESCRIPTION_LENGTH) {
            throw new BadRequestException(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`)
        }

        const existing = await this.categoryRepo.findByNameInsensitive(name)
        if (existing) {
            throw new DuplicateCategoryNameException(name)
        }

        const created = await this.categoryRepo.create({
            name,
            icon: command.icon,
            description,
            createdById: command.actorId
        })

        this.eventBus.publish(new CategoryCreatedEvent(created.id))
        return created
    }
}
