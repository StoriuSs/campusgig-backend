export class ThreadNotFoundException extends Error {
    constructor(public readonly threadId: string) {
        super(`Thread not found: ${threadId}`)
        this.name = 'ThreadNotFoundException'
    }
}
