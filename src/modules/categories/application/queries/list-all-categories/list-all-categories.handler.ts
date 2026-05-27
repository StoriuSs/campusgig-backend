import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { ListAllCategoriesQuery } from './list-all-categories.query'
import { CategoryRepositoryPort, CATEGORY_REPOSITORY_PORT, CategoryEntity } from '@/modules/categories/domain'

@QueryHandler(ListAllCategoriesQuery)
export class ListAllCategoriesHandler implements IQueryHandler<ListAllCategoriesQuery> {
    constructor(@Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort) {}

    async execute(_query: ListAllCategoriesQuery): Promise<CategoryEntity[]> {
        return this.categoryRepo.findAll()
    }
}
