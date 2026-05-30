export class GetOrderEventsQuery {
    constructor(
        public readonly viewerId: string,
        public readonly orderId: string
    ) {}
}
