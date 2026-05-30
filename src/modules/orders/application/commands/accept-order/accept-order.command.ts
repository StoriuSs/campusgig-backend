export class AcceptOrderCommand {
    constructor(
        public readonly viewerId: string, // must be the seller
        public readonly orderId: string
    ) {}
}
