export class ResumeGigCommand {
    constructor(
        public readonly gigId: string,
        public readonly callerId: string
    ) {}
}
