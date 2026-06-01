export class DisputeNotReviewableException extends Error {
    constructor(public readonly status: string) {
        super(`A dispute in status ${status} is not ready for an admin verdict`)
        this.name = 'DisputeNotReviewableException'
    }
}
