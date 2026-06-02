export class GetRecentNotificationsQuery {
    constructor(
        public readonly recipientId: string,
        public readonly limit: number
    ) {}
}
