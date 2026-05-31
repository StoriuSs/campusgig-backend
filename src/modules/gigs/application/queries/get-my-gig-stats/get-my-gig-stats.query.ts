import { GigStatsPeriod } from '@/modules/gigs/domain'

export class GetMyGigStatsQuery {
    constructor(
        public readonly gigId: string,
        public readonly callerId: string,
        public readonly period: GigStatsPeriod
    ) {}
}
