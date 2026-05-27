export class AdminCannotCreateGigException extends Error {
    constructor() {
        super('Admin accounts cannot create gigs.')
        this.name = 'AdminCannotCreateGigException'
    }
}
