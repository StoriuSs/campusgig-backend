import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { ListAdminGigQueueQuery } from './list-admin-gig-queue.query'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    AdminQueueResult,
    AdminQueueStatusFilter,
    AdminQueueSort
} from '@/modules/gigs/domain'

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

const VALID_STATUS: readonly AdminQueueStatusFilter[] = ['all', 'firstSubmission', 'reReview']
const VALID_SORT: readonly AdminQueueSort[] = ['oldest', 'newest', 'priceHigh', 'priceLow']

export interface ListAdminGigQueueResult extends AdminQueueResult {
    page: number
    pageSize: number
}

@QueryHandler(ListAdminGigQueueQuery)
export class ListAdminGigQueueHandler implements IQueryHandler<ListAdminGigQueueQuery> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(query: ListAdminGigQueueQuery): Promise<ListAdminGigQueueResult> {
        const page = Math.max(1, Math.floor(query.page) || 1)
        const pageSize = Math.min(Math.max(1, Math.floor(query.pageSize) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
        const status: AdminQueueStatusFilter = VALID_STATUS.includes(query.status) ? query.status : 'all'
        const sort: AdminQueueSort = VALID_SORT.includes(query.sort) ? query.sort : 'oldest'
        const q = query.q?.trim() || undefined
        const categoryId = query.categoryId?.trim() || undefined

        const result = await this.gigRepo.findForAdminQueue({ status, sort, page, pageSize, q, categoryId })

        return { ...result, page, pageSize }
    }
}
