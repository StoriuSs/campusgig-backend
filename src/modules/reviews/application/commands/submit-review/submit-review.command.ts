export class SubmitReviewCommand {
    constructor(
        public readonly viewerId: string,
        public readonly orderId: string,
        public readonly ratingHalfStars: number,
        public readonly body: string
    ) {}
}
