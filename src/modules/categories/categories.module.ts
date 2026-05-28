import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { CATEGORY_REPOSITORY_PORT } from './domain'
import {
    CreateCategoryHandler,
    UpdateCategoryHandler,
    DeleteCategoryHandler,
    ListCategoriesHandler,
    ListAllCategoriesHandler,
    ListAllCategoriesWithCountHandler,
    InvalidatePublicCategoriesCacheHandler
} from './application'
import { PrismaCategoryRepository } from './infrastructure'
import { CategoriesController, PublicCategoriesController } from './presentation'

const CommandHandlers = [CreateCategoryHandler, UpdateCategoryHandler, DeleteCategoryHandler]
const QueryHandlers = [ListCategoriesHandler, ListAllCategoriesHandler, ListAllCategoriesWithCountHandler]
const EventHandlers = [InvalidatePublicCategoriesCacheHandler]

@Module({
    imports: [CqrsModule],
    controllers: [CategoriesController, PublicCategoriesController],
    providers: [
        { provide: CATEGORY_REPOSITORY_PORT, useClass: PrismaCategoryRepository },
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers
    ],
    // Exported so cross-module callers (e.g. GigsModule's CreateGigHandler /
    // UpdateGigHandler) can inject CATEGORY_REPOSITORY_PORT.
    exports: [CATEGORY_REPOSITORY_PORT]
})
export class CategoriesModule {}
