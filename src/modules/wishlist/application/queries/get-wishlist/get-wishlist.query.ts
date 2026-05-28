export class GetWishlistQuery {
    constructor(
        public readonly userId: string,
        public readonly page: number = 1,
        public readonly pageSize: number = 20
    ) {}
}
