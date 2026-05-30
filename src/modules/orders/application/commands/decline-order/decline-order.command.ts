export class DeclineOrderCommand {
    constructor(
        public readonly viewerId: string, // must be the seller
        public readonly orderId: string,
        public readonly note: string // shown to the buyer on Cancelled view
    ) {}
}
