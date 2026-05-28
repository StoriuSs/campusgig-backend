export class UnsaveGigCommand {
    constructor(
        public readonly userId: string,
        public readonly gigId: string
    ) {}
}
