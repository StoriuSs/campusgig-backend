import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { ListAllCategoriesWithCountQuery } from './list-all-categories-with-count.query'
import { CategoryRepositoryPort, CATEGORY_REPOSITORY_PORT, CategoryEntity } from '@/modules/categories/domain'

@QueryHandler(ListAllCategoriesWithCountQuery)
export class ListAllCategoriesWithCountHandler implements IQueryHandler<ListAllCategoriesWithCountQuery> {
    constructor(@Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort) {}

    async execute(
        _query: ListAllCategoriesWithCountQuery
    ): Promise<Array<CategoryEntity & { activeGigCount: number }>> {
        return this.categoryRepo.findAllWithGigCount()
    }
}
