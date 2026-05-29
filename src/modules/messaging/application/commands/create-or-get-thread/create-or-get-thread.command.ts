export class CreateOrGetThreadCommand {
    constructor(
        public readonly viewerId: string,
        public readonly otherUserId: string
    ) {}
}
