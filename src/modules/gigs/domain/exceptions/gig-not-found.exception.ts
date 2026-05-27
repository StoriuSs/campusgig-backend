export class GigNotFoundException extends Error {
    constructor(public readonly identifier: string) {
        super(`Gig not found: ${identifier}`)
        this.name = 'GigNotFoundException'
    }
}
