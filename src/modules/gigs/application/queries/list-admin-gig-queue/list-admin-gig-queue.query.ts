import type { AdminQueueStatusFilter, AdminQueueSort } from '@/modules/gigs/domain'

export class ListAdminGigQueueQuery {
    constructor(
        public readonly status: AdminQueueStatusFilter,
        public readonly sort: AdminQueueSort,
        public readonly page: number,
        public readonly pageSize: number,
        public readonly categoryId?: string,
        public readonly q?: string
    ) {}
}
