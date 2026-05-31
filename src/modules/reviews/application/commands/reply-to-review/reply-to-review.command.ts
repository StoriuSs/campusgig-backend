export class ReplyToReviewCommand {
    constructor(
        public readonly viewerId: string,
        public readonly reviewId: string,
        public readonly body: string
    ) {}
}
