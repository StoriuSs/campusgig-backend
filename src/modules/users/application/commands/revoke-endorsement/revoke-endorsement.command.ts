export class RevokeEndorsementCommand {
    constructor(
        public readonly userId: string,
        public readonly adminId: string
    ) {}
}
