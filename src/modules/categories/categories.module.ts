import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { CATEGORY_REPOSITORY_PORT } from './domain'
import {
    CreateCategoryHandler,
    UpdateCategoryHandler,
    DeleteCategoryHandler,
    ListCategoriesHandler
} from './application'
import { PrismaCategoryRepository } from './infrastructure'
import { CategoriesController } from './presentation'

const CommandHandlers = [CreateCategoryHandler, UpdateCategoryHandler, DeleteCategoryHandler]
const QueryHandlers = [ListCategoriesHandler]

@Module({
    imports: [CqrsModule],
    controllers: [CategoriesController],
    providers: [
        { provide: CATEGORY_REPOSITORY_PORT, useClass: PrismaCategoryRepository },
        ...CommandHandlers,
        ...QueryHandlers
    ]
})
export class CategoriesModule {}
