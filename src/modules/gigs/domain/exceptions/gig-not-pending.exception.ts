/**
 * Thrown when an admin tries to approve or reject a gig that is not currently
 * in `Pending` review (Feature 05). Guards against a two-admin race where one
 * admin's verdict lands after another already decided.
 */
export class GigNotPendingException extends Error {
    constructor(
        public readonly gigId: string,
        public readonly currentStatus?: string
    ) {
        super(
            `Gig ${gigId} is not pending review${currentStatus ? ` (current status: ${currentStatus})` : ''} and cannot be approved or rejected.`
        )
        this.name = 'GigNotPendingException'
    }
}
