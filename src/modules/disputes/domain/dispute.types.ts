// String unions mirroring the Prisma enums — keep in sync with disputes.prisma.
// Application/domain layers depend on these, never on @prisma/client.

export type DisputeStatus = 'AwaitingResponse' | 'ReadyForReview' | 'Resolved'

export type DisputeParty = 'Buyer' | 'Seller'

export type DisputeVerdict = 'RefundBuyer' | 'CompleteForSeller' | 'SplitFunds'

export type DisputeReasonCode =
    // Buyer-filed
    | 'WorkNotAsDescribed'
    | 'SellerNeverDelivered'
    | 'SellerHarassment'
    | 'BuyerOther'
    // Seller-filed
    | 'BuyerOutOfScope'
    | 'BuyerReviewThreat'
    | 'BuyerUnreachable'
    | 'SellerOther'

export const BUYER_REASON_CODES: readonly DisputeReasonCode[] = [
    'WorkNotAsDescribed',
    'SellerNeverDelivered',
    'SellerHarassment',
    'BuyerOther'
]

export const SELLER_REASON_CODES: readonly DisputeReasonCode[] = [
    'BuyerOutOfScope',
    'BuyerReviewThreat',
    'BuyerUnreachable',
    'SellerOther'
]

// Platform always keeps 20%; a Split buyer-refund percentage runs 0–80.
export const PLATFORM_FEE_PCT = 20
export const MAX_BUYER_REFUND_PCT = 100 - PLATFORM_FEE_PCT // 80

export interface DisputePayoutShares {
    buyerRefundVnd: number
    sellerEarningVnd: number
    platformFeeVnd: number
}
