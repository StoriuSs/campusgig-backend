export class DecideCancellationCommand {
    constructor(
        public readonly viewerId: string,
        public readonly cancellationId: string,
        public readonly decision: 'accept' | 'reject'
    ) {}
}
