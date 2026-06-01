export class DisputeNotFoundException extends Error {
    constructor(public readonly orderId: string) {
        super(`No dispute found for order ${orderId}`)
        this.name = 'DisputeNotFoundException'
    }
}
