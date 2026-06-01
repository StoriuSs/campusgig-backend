import { computeDisputePayout } from './compute-dispute-payout'
import { InvalidSplitPercentException } from '../exceptions/invalid-split-percent.exception'

describe('computeDisputePayout', () => {
    const sum = (s: { buyerRefundVnd: number; sellerEarningVnd: number; platformFeeVnd: number }) =>
        s.buyerRefundVnd + s.sellerEarningVnd + s.platformFeeVnd

    it('RefundBuyer returns the full price to the buyer', () => {
        expect(computeDisputePayout(500_000, 'RefundBuyer')).toEqual({
            buyerRefundVnd: 500_000,
            sellerEarningVnd: 0,
            platformFeeVnd: 0
        })
    })

    it('CompleteForSeller splits 80/20 seller/platform (seller-favoring rounding)', () => {
        expect(computeDisputePayout(500_000, 'CompleteForSeller')).toEqual({
            buyerRefundVnd: 0,
            sellerEarningVnd: 400_000,
            platformFeeVnd: 100_000
        })
    })

    it('SplitFunds matches the SRS example (500K @ 60% → 300K / 100K / 100K)', () => {
        expect(computeDisputePayout(500_000, 'SplitFunds', 60)).toEqual({
            buyerRefundVnd: 300_000,
            sellerEarningVnd: 100_000,
            platformFeeVnd: 100_000
        })
    })

    it.each([0, 20, 40, 60, 80])('SplitFunds @ %i%% keeps platform whole and sums to P', (b) => {
        const P = 499_999 // odd price to exercise rounding
        const shares = computeDisputePayout(P, 'SplitFunds', b)
        expect(sum(shares)).toBe(P) // escrow nets to exactly 0
        expect(shares.platformFeeVnd).toBeGreaterThanOrEqual(Math.floor((P * 20) / 100))
        expect(shares.buyerRefundVnd).toBe(Math.floor((P * b) / 100))
    })

    it('SplitFunds @ 0% gives the seller everything but the platform cut', () => {
        const shares = computeDisputePayout(500_000, 'SplitFunds', 0)
        expect(shares.buyerRefundVnd).toBe(0)
        expect(shares.sellerEarningVnd).toBe(400_000)
        expect(shares.platformFeeVnd).toBe(100_000)
    })

    it('SplitFunds @ 80% leaves the seller nothing', () => {
        const shares = computeDisputePayout(500_000, 'SplitFunds', 80)
        expect(shares.buyerRefundVnd).toBe(400_000)
        expect(shares.sellerEarningVnd).toBe(0)
        expect(shares.platformFeeVnd).toBe(100_000)
    })

    it.each([-1, 81, 100, 50.5, null, undefined])('rejects invalid split percent %s', (b) => {
        expect(() => computeDisputePayout(500_000, 'SplitFunds', b as number)).toThrow(InvalidSplitPercentException)
    })
})
