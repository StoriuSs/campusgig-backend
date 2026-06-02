// Published when a gig is created and enters Pending (awaiting admin review).
// Seam for F15 admin notifications ("New gig pending review").
export class GigSubmittedEvent {
    constructor(
        public readonly gigId: string,
        public readonly sellerId: string,
        public readonly gigTitle: string
    ) {}
}
