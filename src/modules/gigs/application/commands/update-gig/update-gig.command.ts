export class UpdateGigCommand {
    constructor(
        public readonly gigId: string,
        public readonly callerId: string,
        public readonly patch: {
            title?: string
            categoryId?: string
            description?: string
            priceVnd?: number
            deliveryDays?: number
            imageIds?: string[]
            bullets?: string[]
            faqs?: Array<{ question: string; answer: string }>
        }
    ) {}
}
