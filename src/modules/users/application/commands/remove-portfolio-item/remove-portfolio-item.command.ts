export class RemovePortfolioItemCommand {
    constructor(
        public readonly userId: string,
        public readonly itemId: string
    ) {}
}
