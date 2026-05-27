import { GigStatus } from '../value-objects/gig-status'

export class InvalidGigStatusTransitionException extends Error {
    constructor(
        public readonly from: GigStatus,
        public readonly to: GigStatus
    ) {
        super(`Invalid gig status transition: ${from} → ${to}`)
        this.name = 'InvalidGigStatusTransitionException'
    }
}
