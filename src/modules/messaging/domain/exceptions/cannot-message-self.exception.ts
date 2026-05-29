export class CannotMessageSelfException extends Error {
    constructor(public readonly userId: string) {
        super(`User ${userId} cannot start a thread with themselves`)
        this.name = 'CannotMessageSelfException'
    }
}
