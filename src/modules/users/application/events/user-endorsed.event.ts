// F14 — published when an admin endorses a user. Seam for F15 notifications.
export class UserEndorsedEvent {
    constructor(
        public readonly userId: string,
        public readonly adminId: string
    ) {}
}
