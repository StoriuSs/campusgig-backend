export class PendingExtensionAlreadyExistsException extends Error {
    constructor(public readonly orderId: string) {
        super(`Order ${orderId} already has a pending extension request`)
        this.name = 'PendingExtensionAlreadyExistsException'
    }
}
