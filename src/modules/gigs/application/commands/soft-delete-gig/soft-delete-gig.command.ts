export class SoftDeleteGigCommand {
    constructor(
        public readonly gigId: string,
        public readonly callerId: string
    ) {}
}
