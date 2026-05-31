export const PUBLIC_GIGS_REPOSITORY_PORT = 'PUBLIC_GIGS_REPOSITORY_PORT'

export interface PublicGigSellerSummary {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
    isEndorsed: boolean
}

export interface PublicGigSummary {
    id: string
    title: string
    priceVnd: number
    deliveryDays: number
    coverImageKey: string | null
    avgRating: number | null
    reviewCount: number
    isSaved: boolean
    seller: PublicGigSellerSummary
}

export interface PublicGigImage {
    id: string
    imageKey: string
    width: number
    height: number
    position: number
}

export interface PublicGigBullet {
    id: string
    text: string
}

export interface PublicGigFaq {
    id: string
    question: string
    answer: string
}

export interface PublicGigDetailSeller extends PublicGigSellerSummary {
    bio: string | null
    roleLine: string | null
    location: string | null
    languages: string | null
    skills: string[]
    joinedAt: Date
    gigCount: number
    avgRating: number | null
    reviewCount: number
    completedOrderCount: number
}

export interface PublicGigDetail {
    id: string
    title: string
    description: string
    priceVnd: number
    deliveryDays: number
    categoryId: string
    categoryName: string
    avgRating: number | null
    reviewCount: number
    completedOrderCount: number
    // Accepted but not yet finished (excludes Completed/Cancelled).
    inQueueOrderCount: number
    isSaved: boolean
    images: PublicGigImage[]
    bullets: PublicGigBullet[]
    faqs: PublicGigFaq[]
    seller: PublicGigDetailSeller
    similarGigs: PublicGigSummary[]
    otherBySellerGigs: PublicGigSummary[]
}

export interface BrowseGigsFilters {
    q?: string
    categoryId?: string
    minPrice?: number
    maxPrice?: number
    minRating?: number
    maxDelivery?: number
    endorsedOnly?: boolean
    sellerId?: string
    sort: 'newest' | 'rating' | 'priceAsc' | 'priceDesc'
    page: number
    pageSize: number
    userId?: string
}

export interface BrowseGigsResult {
    items: PublicGigSummary[]
    total: number
    page: number
    pageSize: number
}

export interface PublicGigsRepositoryPort {
    browse(filters: BrowseGigsFilters): Promise<BrowseGigsResult>
    findById(id: string, userId?: string): Promise<PublicGigDetail | null>
}
