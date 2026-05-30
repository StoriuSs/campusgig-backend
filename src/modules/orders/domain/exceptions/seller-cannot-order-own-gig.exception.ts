export class SellerCannotOrderOwnGigException extends Error {
    constructor(
        public readonly gigId: string,
        public readonly viewerId: string
    ) {
        super(`Seller ${viewerId} cannot place an order on their own gig ${gigId}`)
        this.name = 'SellerCannotOrderOwnGigException'
    }
}
