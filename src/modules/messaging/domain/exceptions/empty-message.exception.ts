export class EmptyMessageException extends Error {
    constructor() {
        super('Message must have a body or at least one attachment')
        this.name = 'EmptyMessageException'
    }
}
