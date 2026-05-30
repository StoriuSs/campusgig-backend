export class UpdateDeliveryCommand {
    constructor(
        public readonly viewerId: string,
        public readonly orderId: string,
        // Optional — files-only updates are valid. Empty string when missing.
        public readonly note: string | undefined,
        // Staged via POST /orders/:orderId/deliveries/staged-files — the
        // same staging endpoint that deliverWork uses. The repo claims
        // them by id inside the same $transaction as the new Delivery row.
        public readonly stagedFileIds: string[]
    ) {}
}
