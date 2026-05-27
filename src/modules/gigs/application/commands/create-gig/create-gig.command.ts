export class CreateGigCommand {
    constructor(
        public readonly callerId: string,
        public readonly callerIsAdmin: boolean,
        public readonly title: string,
        public readonly categoryId: string,
        public readonly description: string,
        public readonly priceVnd: number,
        public readonly deliveryDays: number,
        public readonly imageIds: string[],
        public readonly bullets: string[],
        public readonly faqs: Array<{ question: string; answer: string }>
    ) {}
}
