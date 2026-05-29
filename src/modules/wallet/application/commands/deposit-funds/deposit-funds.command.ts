export class DepositFundsCommand {
    constructor(
        public readonly userId: string,
        public readonly amountVnd: number
    ) {}
}
