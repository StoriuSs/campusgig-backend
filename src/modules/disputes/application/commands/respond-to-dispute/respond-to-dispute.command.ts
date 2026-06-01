export class RespondToDisputeCommand {
    constructor(
        public readonly orderId: string,
        public readonly viewerId: string,
        public readonly statement: string,
        public readonly evidenceFileIds: string[]
    ) {}
}
