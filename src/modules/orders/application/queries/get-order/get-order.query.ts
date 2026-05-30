export class GetOrderQuery {
    constructor(
        public readonly viewerId: string,
        public readonly orderId: string
    ) {}
}
