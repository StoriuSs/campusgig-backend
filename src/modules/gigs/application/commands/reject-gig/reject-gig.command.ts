export class RejectGigCommand {
    constructor(
        public readonly gigId: string,
        public readonly adminId: string,
        public readonly rejectionCategory: string,
        public readonly rejectionReason: string
    ) {}
}
