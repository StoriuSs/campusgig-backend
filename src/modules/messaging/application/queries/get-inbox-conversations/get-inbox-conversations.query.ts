export class GetInboxConversationsQuery {
    constructor(
        public readonly viewerId: string,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
