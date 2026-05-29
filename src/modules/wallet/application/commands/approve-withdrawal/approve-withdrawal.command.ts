export class ApproveWithdrawalCommand {
    constructor(
        public readonly withdrawalId: string,
        public readonly adminId: string
    ) {}
}
