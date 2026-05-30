export class GetThreadMessagesQuery {
    constructor(
        public readonly viewerId: string,
        public readonly threadId: string,
        public readonly beforeId: string | null,
        public readonly pageSize: number,
        // When set, the repository interleaves system events emitted for this
        // order into the result. Inbox passes null; Order Workspace passes the
        // order id so transition cards appear inline in the chat.
        public readonly orderId: string | null = null
    ) {}
}
