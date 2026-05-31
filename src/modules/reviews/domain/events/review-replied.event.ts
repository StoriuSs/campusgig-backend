// Raised after a seller reply is committed. Invalidates the gig's cached
// review lists + public gig detail so the reply shows immediately.
export class ReviewRepliedEvent {
    constructor(
        public readonly reviewId: string,
        public readonly gigId: string
    ) {}
}
