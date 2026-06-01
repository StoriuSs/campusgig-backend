export class AlreadyRespondedException extends Error {
    constructor(public readonly orderId: string) {
        super(`The dispute on order ${orderId} has already received a response`)
        this.name = 'AlreadyRespondedException'
    }
}
