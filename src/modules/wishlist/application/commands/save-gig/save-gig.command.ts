export class SaveGigCommand {
    constructor(
        public readonly userId: string,
        public readonly gigId: string
    ) {}
}
