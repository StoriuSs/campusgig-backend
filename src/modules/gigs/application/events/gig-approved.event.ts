/**
 * Published when an admin approves a gig (Pending → Active, Feature 05).
 *
 * No subscribers in F05. This is the seam for:
 *   - F15 Notifications ("Your gig has been approved").
 *   - F14 Activity Log (admin verdict audit trail).
 *   - F06 public-gig cache invalidation (an approved gig becomes browseable).
 */
export class GigApprovedEvent {
    constructor(
        public readonly gigId: string,
        public readonly sellerId: string,
        public readonly gigTitle: string
    ) {}
}
