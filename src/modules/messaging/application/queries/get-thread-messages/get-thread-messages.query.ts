export class GetThreadMessagesQuery {
    constructor(
        public readonly viewerId: string,
        public readonly threadId: string,
        public readonly beforeId: string | null,
        public readonly pageSize: number
    ) {}
}
