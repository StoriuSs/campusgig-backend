export class GigBulletCapReachedException extends Error {
    constructor() {
        super('Maximum of 5 "what\'s included" bullets allowed per gig.')
        this.name = 'GigBulletCapReachedException'
    }
}
