import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { ListCategoriesQuery } from './list-categories.query'
import { CategoryRepositoryPort, CATEGORY_REPOSITORY_PORT, CategoryListResult } from '@/modules/categories/domain'

const MAX_PAGE_SIZE = 100

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesHandler implements IQueryHandler<ListCategoriesQuery> {
    constructor(@Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort) {}

    async execute(query: ListCategoriesQuery): Promise<CategoryListResult> {
        const page = Math.max(1, Math.floor(query.page) || 1)
        const pageSize = Math.min(Math.max(1, Math.floor(query.pageSize) || 20), MAX_PAGE_SIZE)

        return this.categoryRepo.listPaginated({ page, pageSize })
    }
}
