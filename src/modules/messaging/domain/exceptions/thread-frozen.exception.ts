// F12 — chat between two users is locked while they have an active dispute
// (a Frozen order). Reopens once the dispute resolves.
export class ThreadFrozenException extends Error {
    constructor() {
        super('Chat is locked while a dispute between you and this user is under review')
        this.name = 'ThreadFrozenException'
    }
}
