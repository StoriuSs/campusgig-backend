/**
 * Thrown when a seller tries to edit, pause, or delete a gig that is currently
 * in `Pending` (admin review). Locking the gig during review avoids a race
 * where the admin approves/rejects content the seller changed mid-review.
 *
 * Not in the SRS explicitly — a deliberate design choice (see SRS § I.3 note
 * added in Feature 04). The seller acts on the gig after the verdict instead.
 */
export class GigLockedForReviewException extends Error {
    constructor(public readonly gigId: string) {
        super(`Gig ${gigId} is locked while in review and cannot be edited, paused, or deleted.`)
        this.name = 'GigLockedForReviewException'
    }
}
