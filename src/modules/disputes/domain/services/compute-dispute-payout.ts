import { DisputePayoutShares, DisputeVerdict, MAX_BUYER_REFUND_PCT, PLATFORM_FEE_PCT } from '../dispute.types'
import { InvalidSplitPercentException } from '../exceptions/invalid-split-percent.exception'

// Splits the escrowed price `P` per the verdict. Platform absorbs the rounding
// remainder so the three shares always sum to exactly `P` (escrow nets to 0).
// `buyerRefundPercent` is required for SplitFunds (0–80) and ignored otherwise.
export function computeDisputePayout(
    priceVnd: number,
    verdict: DisputeVerdict,
    buyerRefundPercent?: number | null
): DisputePayoutShares {
    switch (verdict) {
        case 'RefundBuyer':
            return { buyerRefundVnd: priceVnd, sellerEarningVnd: 0, platformFeeVnd: 0 }

        case 'CompleteForSeller': {
            const platformFeeVnd = Math.floor((priceVnd * PLATFORM_FEE_PCT) / 100)
            return { buyerRefundVnd: 0, sellerEarningVnd: priceVnd - platformFeeVnd, platformFeeVnd }
        }

        case 'SplitFunds': {
            if (
                buyerRefundPercent == null ||
                !Number.isInteger(buyerRefundPercent) ||
                buyerRefundPercent < 0 ||
                buyerRefundPercent > MAX_BUYER_REFUND_PCT
            ) {
                throw new InvalidSplitPercentException(buyerRefundPercent)
            }
            const buyerRefundVnd = Math.floor((priceVnd * buyerRefundPercent) / 100)
            const sellerEarningVnd = Math.floor((priceVnd * (MAX_BUYER_REFUND_PCT - buyerRefundPercent)) / 100)
            // Platform takes whatever is left so the split is exact.
            const platformFeeVnd = priceVnd - buyerRefundVnd - sellerEarningVnd
            return { buyerRefundVnd, sellerEarningVnd, platformFeeVnd }
        }
    }
}
