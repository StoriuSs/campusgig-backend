export class NotAThreadParticipantException extends Error {
    constructor(
        public readonly threadId: string,
        public readonly viewerId: string
    ) {
        super(`User ${viewerId} is not a participant of thread ${threadId}`)
        this.name = 'NotAThreadParticipantException'
    }
}
