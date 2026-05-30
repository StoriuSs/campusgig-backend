export class PendingCancellationAlreadyExistsException extends Error {
    constructor(public readonly orderId: string) {
        super(`Order ${orderId} already has a pending cancellation request`)
        this.name = 'PendingCancellationAlreadyExistsException'
    }
}
