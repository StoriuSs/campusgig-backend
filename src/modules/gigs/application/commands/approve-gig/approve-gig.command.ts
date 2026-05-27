export class ApproveGigCommand {
    constructor(
        public readonly gigId: string,
        public readonly adminId: string
    ) {}
}
