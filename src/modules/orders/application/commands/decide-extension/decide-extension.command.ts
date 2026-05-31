export class DecideExtensionCommand {
    constructor(
        public readonly viewerId: string,
        public readonly extensionId: string,
        public readonly decision: 'accept' | 'reject'
    ) {}
}
