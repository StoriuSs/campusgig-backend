export class NotAParticipantException extends Error {
    constructor(public readonly orderId: string) {
        super(`Caller is not a participant of order ${orderId}`)
        this.name = 'NotAParticipantException'
    }
}
