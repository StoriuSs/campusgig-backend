/**
 * Published when an admin rejects a gig (Pending → Rejected, Feature 05).
 *
 * No subscribers in F05. Seam for F15 Notifications ("Your gig was rejected.
 * Reason: ...") and F14 Activity Log.
 */
export class GigRejectedEvent {
    constructor(
        public readonly gigId: string,
        public readonly sellerId: string,
        public readonly rejectionCategory: string,
        public readonly rejectionReason: string
    ) {}
}
