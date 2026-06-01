import { DisputeVerdict } from '../../../domain/dispute.types'

export class ResolveDisputeCommand {
    constructor(
        public readonly orderId: string,
        public readonly adminId: string,
        public readonly verdict: DisputeVerdict,
        public readonly buyerRefundPercent: number | null,
        public readonly adminNotes: string | null
    ) {}
}
