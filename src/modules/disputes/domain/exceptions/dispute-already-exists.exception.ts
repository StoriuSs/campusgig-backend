export class DisputeAlreadyExistsException extends Error {
    constructor(public readonly orderId: string) {
        super(`Order ${orderId} already has a dispute`)
        this.name = 'DisputeAlreadyExistsException'
    }
}
