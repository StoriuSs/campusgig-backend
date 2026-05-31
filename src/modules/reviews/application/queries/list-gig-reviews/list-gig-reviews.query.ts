import { PublicReviewTier } from '../../../domain/ports/reviews.repository.port'

export class ListGigReviewsQuery {
    constructor(
        public readonly gigId: string,
        public readonly tier: PublicReviewTier,
        public readonly query: string | null,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
