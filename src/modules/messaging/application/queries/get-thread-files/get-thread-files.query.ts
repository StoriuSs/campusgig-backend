export class GetThreadFilesQuery {
    constructor(
        public readonly viewerId: string,
        public readonly threadId: string,
        // Order Workspace passes the active order id so the Files modal
        // surfaces only attachments tied to THAT order, not the whole
        // buyer↔seller inbox history. Inbox omits it.
        public readonly orderId: string | null = null
    ) {}
}
