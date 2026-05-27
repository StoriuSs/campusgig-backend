export class GetMyGigByIdQuery {
    constructor(
        public readonly gigId: string,
        public readonly callerId: string
    ) {}
}
