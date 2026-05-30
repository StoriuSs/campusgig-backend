export class DeclineNoteTooShortException extends Error {
    constructor(public readonly min: number) {
        super(`Decline note must be at least ${min} characters`)
        this.name = 'DeclineNoteTooShortException'
    }
}
