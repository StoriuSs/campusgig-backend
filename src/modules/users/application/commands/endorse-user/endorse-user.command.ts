export class EndorseUserCommand {
    constructor(
        public readonly userId: string,
        public readonly adminId: string
    ) {}
}
