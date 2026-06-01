// F14 — published when an admin revokes a user's endorsement. Seam for F15.
export class EndorsementRevokedEvent {
    constructor(
        public readonly userId: string,
        public readonly adminId: string
    ) {}
}
