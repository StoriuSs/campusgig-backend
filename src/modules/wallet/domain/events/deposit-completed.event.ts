export class DepositCompletedEvent {
    constructor(
        public readonly userId: string,
        public readonly transactionId: string,
        public readonly amountVnd: number
    ) {}
}
