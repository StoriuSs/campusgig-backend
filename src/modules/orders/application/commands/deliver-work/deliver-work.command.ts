export class DeliverWorkCommand {
    constructor(
        public readonly viewerId: string,
        public readonly orderId: string,
        // Optional — empty string when the seller didn't write a note. Files
        // are the required payload; the note is just commentary.
        public readonly note: string | undefined,
        // Staged via POST /orders/:orderId/deliveries/staged-files. The repo
        // claims these by setting their `deliveryId` inside the same
        // $transaction as the Delivery insert.
        public readonly stagedFileIds: string[]
    ) {}
}
