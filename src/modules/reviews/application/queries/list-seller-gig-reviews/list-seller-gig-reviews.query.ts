import { ManageReviewSort, ManageReviewStatus, ManageReviewTier } from '../../../domain/ports/reviews.repository.port'

export class ListSellerGigReviewsQuery {
    constructor(
        public readonly viewerId: string,
        public readonly gigId: string,
        public readonly status: ManageReviewStatus,
        public readonly tier: ManageReviewTier,
        public readonly sort: ManageReviewSort,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
