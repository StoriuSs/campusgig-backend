export class WithdrawalRequestedEvent {
    constructor(
        public readonly userId: string,
        public readonly withdrawalRequestId: string,
        public readonly amountVnd: number
    ) {}
}
