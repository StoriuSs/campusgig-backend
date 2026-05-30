export class InsufficientWalletBalanceException extends Error {
    constructor(
        public readonly buyerId: string,
        public readonly required: number,
        public readonly available: number
    ) {
        super(`User ${buyerId} has insufficient wallet balance — required ${required}, available ${available}`)
        this.name = 'InsufficientWalletBalanceException'
    }
}
