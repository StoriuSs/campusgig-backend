export class NotAParticipantException extends Error {
    constructor(
        public readonly orderId: string,
        public readonly viewerId: string
    ) {
        super(`User ${viewerId} is not a participant of order ${orderId}`)
        this.name = 'NotAParticipantException'
    }
}
