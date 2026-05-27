import type { MyGigsStatusFilter, MyGigsSort } from '@/modules/gigs/domain'

export class ListMyGigsQuery {
    constructor(
        public readonly sellerId: string,
        public readonly status: MyGigsStatusFilter,
        public readonly sort: MyGigsSort,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
