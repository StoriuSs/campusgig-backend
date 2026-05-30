export class GigNotPurchasableException extends Error {
    constructor(
        public readonly gigId: string,
        public readonly reason: string
    ) {
        super(`Gig ${gigId} is not purchasable: ${reason}`)
        this.name = 'GigNotPurchasableException'
    }
}
