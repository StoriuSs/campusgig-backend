export const WISHLIST_REPOSITORY_PORT = 'WISHLIST_REPOSITORY_PORT'

export interface WishlistGigSeller {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
    isEndorsed: boolean
}

export interface WishlistGigItem {
    id: string
    title: string
    priceVnd: number
    deliveryDays: number
    coverImageKey: string | null
    savedAt: Date
    seller: WishlistGigSeller
}

export interface GetWishlistResult {
    items: WishlistGigItem[]
    total: number
    page: number
    pageSize: number
}

export type WishlistSort = 'savedAt' | 'priceAsc' | 'priceDesc'

export interface WishlistRepositoryPort {
    save(userId: string, gigId: string): Promise<void>
    unsave(userId: string, gigId: string): Promise<void>
    list(userId: string, page: number, pageSize: number, sort: WishlistSort): Promise<GetWishlistResult>
}
