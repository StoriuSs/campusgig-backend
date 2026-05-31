export const REVIEWS_REPOSITORY_PORT = 'REVIEWS_REPOSITORY_PORT'

// Tier filter buckets. Whole star = round-half-up(ratingHalfStars / 2):
//   5★={9,10}  4★={7,8}  3★={5,6}  2★={3,4}  1★={2}
// Public modal filters by single whole star; the manage view groups the
// bottom two into "1-2".
export type PublicReviewTier = 'all' | '5' | '4' | '3' | '2' | '1'
export type ManageReviewTier = 'all' | '5' | '4' | '3' | '1-2'
export type ManageReviewStatus = 'all' | 'unanswered' | 'answered'
export type ManageReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest'

// avatarKey is the S3 object key — controllers resolve to a presigned URL.
export interface ReviewAuthorInfo {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
}

export interface ReviewItem {
    id: string
    orderId: string
    gigId: string
    sellerId: string
    buyerId: string
    ratingHalfStars: number
    body: string
    replyBody: string | null
    repliedAt: Date | null
    createdAt: Date
    author: ReviewAuthorInfo
}

// Five whole-star buckets + total + average (1-5, null when no reviews).
export interface ReviewSummary {
    total: number
    average: number | null
    tiers: { five: number; four: number; three: number; two: number; one: number }
}

export interface ManageReviewsResult {
    items: ReviewItem[]
    total: number
    answeredCount: number
    unansweredCount: number
    tierCounts: { five: number; four: number; three: number; oneToTwo: number }
}

export interface ReviewsRepositoryPort {
    // Atomic submit: insert Review + increment gig & seller aggregates + insert
    // the order-thread system event, all in one $transaction. Guards
    // (Completed, buyer-only, write-once) live in the handler; the unique
    // orderId is the DB backstop.
    submitReview(input: {
        orderId: string
        buyerId: string
        ratingHalfStars: number
        body: string
    }): Promise<ReviewItem>

    findByOrderId(orderId: string): Promise<ReviewItem | null>
    findById(reviewId: string): Promise<ReviewItem | null>

    // Minimal order facts the SubmitReview guards need (status + buyer). Null when
    // the order doesn't exist.
    getOrderForReview(orderId: string): Promise<{ buyerId: string; status: string } | null>

    // Reply guards in one read: seller ownership, whether already replied, and
    // the gig's current status (reply only allowed while Active).
    findForReply(
        reviewId: string
    ): Promise<{ id: string; sellerId: string; alreadyReplied: boolean; gigStatus: string } | null>

    // Write-once reply (handler enforces gig-Active + ownership + not-already-replied).
    setReply(reviewId: string, body: string): Promise<ReviewItem>

    listForGig(input: {
        gigId: string
        tier: PublicReviewTier
        query: string | null
        skip: number
        take: number
    }): Promise<{ items: ReviewItem[]; total: number }>

    summaryForGig(gigId: string): Promise<ReviewSummary>

    // For the Manage Reviews owner check. Null when the gig doesn't exist.
    getGigSellerId(gigId: string): Promise<string | null>

    listForSellerGig(input: {
        gigId: string
        status: ManageReviewStatus
        tier: ManageReviewTier
        sort: ManageReviewSort
        skip: number
        take: number
    }): Promise<ManageReviewsResult>
}
