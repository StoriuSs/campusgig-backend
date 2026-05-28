export class GetPublicGigByIdQuery {
    constructor(
        public readonly id: string,
        public readonly userId?: string
    ) {}
}
