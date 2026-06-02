// Raised after a review is committed. Drives cache invalidation (gig public +
// gig reviews list) now; F15 will hang the "Review left" seller notification
// off the same event.
export class ReviewSubmittedEvent {
    constructor(
        public readonly reviewId: string,
        public readonly orderId: string,
        public readonly gigId: string,
        public readonly sellerId: string,
        public readonly buyerId: string,
        public readonly ratingHalfStars: number
    ) {}
}
