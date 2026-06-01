import { DisputeReasonCode } from '../../../domain/dispute.types'

export class FileDisputeCommand {
    constructor(
        public readonly orderId: string,
        public readonly viewerId: string,
        public readonly reasonCode: DisputeReasonCode,
        public readonly statement: string,
        public readonly evidenceFileIds: string[]
    ) {}
}
