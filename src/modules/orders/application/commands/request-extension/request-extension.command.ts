export class RequestExtensionCommand {
    constructor(
        public readonly viewerId: string,
        public readonly orderId: string,
        // One of the M1 modal presets: 12 / 24 / 48 / 72 hours.
        public readonly hoursRequested: number,
        public readonly reason: string | null
    ) {}
}
