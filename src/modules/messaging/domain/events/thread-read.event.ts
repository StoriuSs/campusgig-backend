export class ThreadReadEvent {
    constructor(
        public readonly threadId: string,
        public readonly viewerId: string,
        public readonly otherUserId: string,
        public readonly lastReadAt: Date,
        public readonly unreadCleared: number
    ) {}
}
