export class GigImageCapReachedException extends Error {
    constructor() {
        super('Maximum of 10 images allowed per gig.')
        this.name = 'GigImageCapReachedException'
    }
}
