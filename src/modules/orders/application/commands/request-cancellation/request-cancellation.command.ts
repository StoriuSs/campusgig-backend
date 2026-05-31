import type { CancellationReasonCode } from '../../../domain/ports'

export class RequestCancellationCommand {
    constructor(
        public readonly viewerId: string,
        public readonly orderId: string,
        public readonly reasonCode: CancellationReasonCode,
        // Required when reasonCode ends in 'Other'. Stored separately so the
        // counterparty's decision card can show both the canned reason +
        // free-text explanation.
        public readonly otherText: string | null
    ) {}
}
