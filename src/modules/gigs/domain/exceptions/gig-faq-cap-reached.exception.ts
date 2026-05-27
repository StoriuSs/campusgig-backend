export class GigFaqCapReachedException extends Error {
    constructor() {
        super('Maximum of 5 FAQ entries allowed per gig.')
        this.name = 'GigFaqCapReachedException'
    }
}
