export class AcceptDeliveryCommand {
    constructor(
        public readonly viewerId: string, // must be the buyer
        public readonly orderId: string
    ) {}
}
