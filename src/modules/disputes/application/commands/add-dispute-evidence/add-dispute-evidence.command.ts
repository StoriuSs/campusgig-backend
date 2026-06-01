export class AddDisputeEvidenceCommand {
    constructor(
        public readonly orderId: string,
        public readonly viewerId: string,
        public readonly evidenceFileIds: string[]
    ) {}
}
