export class PlaceOrderCommand {
    constructor(
        public readonly buyerId: string,
        public readonly gigId: string,
        // Request-level dedupe so a double-click doesn't double-charge.
        // Matches the @Idempotent pattern used by the wallet module.
        public readonly idempotencyKey: string
    ) {}
}
