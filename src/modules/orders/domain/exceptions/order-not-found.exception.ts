export class OrderNotFoundException extends Error {
    constructor(public readonly orderId: string) {
        super(`Order not found: ${orderId}`)
        this.name = 'OrderNotFoundException'
    }
}
