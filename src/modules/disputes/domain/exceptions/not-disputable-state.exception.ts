export class NotDisputableStateException extends Error {
    constructor(public readonly status: string) {
        super(`An order in status ${status} cannot be disputed`)
        this.name = 'NotDisputableStateException'
    }
}
