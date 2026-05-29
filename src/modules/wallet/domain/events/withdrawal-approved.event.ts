export class WithdrawalApprovedEvent {
    constructor(
        public readonly userId: string,
        public readonly withdrawalRequestId: string,
        public readonly adminId: string,
        public readonly amountVnd: number
    ) {}
}
