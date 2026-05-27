export class PauseGigCommand {
    constructor(
        public readonly gigId: string,
        public readonly callerId: string
    ) {}
}
