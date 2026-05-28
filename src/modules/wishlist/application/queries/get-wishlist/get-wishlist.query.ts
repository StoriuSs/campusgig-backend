import type { WishlistSort } from '../../../domain/ports/wishlist.repository.port'

export class GetWishlistQuery {
    constructor(
        public readonly userId: string,
        public readonly page: number = 1,
        public readonly pageSize: number = 20,
        public readonly sort: WishlistSort = 'savedAt'
    ) {}
}
