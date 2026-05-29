export class SendMessageCommand {
    constructor(
        public readonly senderId: string,
        public readonly threadId: string,
        public readonly body: string | null,
        public readonly attachmentIds: string[],
        // F08 only sends inbox messages (orderId = null). Kept on the command
        // so F10/F11 (Order Workspace) can reuse the same path without forking.
        public readonly orderId: string | null = null
    ) {}
}
