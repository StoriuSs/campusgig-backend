export class PresenceChangedEvent {
    constructor(
        public readonly userId: string,
        public readonly online: boolean,
        public readonly lastSeenAt: Date | null,
        // Peer ids that should receive the presence:update emit. Pre-computed
        // by the gateway since the event handler is sync-light.
        public readonly notifyUserIds: string[]
    ) {}
}
