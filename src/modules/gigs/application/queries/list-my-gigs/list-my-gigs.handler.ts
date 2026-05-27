import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { ListMyGigsQuery } from './list-my-gigs.query'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    MyGigsListResult,
    MyGigsStatusFilter,
    MyGigsSort
} from '@/modules/gigs/domain'

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

const VALID_STATUS: readonly MyGigsStatusFilter[] = ['all', 'active', 'paused', 'pending', 'rejected']
const VALID_SORT: readonly MyGigsSort[] = [
    'newest',
    'oldest',
    'mostOrders',
    'highestRated',
    'highestEarnings',
    'recentlyUpdated'
]

export interface ListMyGigsResult extends MyGigsListResult {
    page: number
    pageSize: number
    counts: Record<MyGigsStatusFilter, number>
}

@QueryHandler(ListMyGigsQuery)
export class ListMyGigsHandler implements IQueryHandler<ListMyGigsQuery> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(query: ListMyGigsQuery): Promise<ListMyGigsResult> {
        const page = Math.max(1, Math.floor(query.page) || 1)
        const pageSize = Math.min(Math.max(1, Math.floor(query.pageSize) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
        const status: MyGigsStatusFilter = VALID_STATUS.includes(query.status) ? query.status : 'all'
        const sort: MyGigsSort = VALID_SORT.includes(query.sort) ? query.sort : 'newest'

        const [list, counts] = await Promise.all([
            this.gigRepo.findMine({ sellerId: query.sellerId, status, sort, page, pageSize }),
            this.gigRepo.countByStatus(query.sellerId)
        ])

        return {
            items: list.items,
            total: list.total,
            page,
            pageSize,
            counts
        }
    }
}
