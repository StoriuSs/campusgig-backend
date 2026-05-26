export class AddPortfolioItemCommand {
    constructor(
        public readonly userId: string,
        public readonly fileBuffer: Buffer,
        public readonly originalName: string
    ) {}
}
