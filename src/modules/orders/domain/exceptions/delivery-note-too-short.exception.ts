export class DeliveryNoteTooShortException extends Error {
    constructor(public readonly min: number) {
        super(`Delivery note must be at least ${min} characters`)
        this.name = 'DeliveryNoteTooShortException'
    }
}
