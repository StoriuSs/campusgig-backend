import { DashboardPeriod } from '../../period.util'

export class GetSellerDashboardQuery {
    constructor(
        public readonly userId: string,
        public readonly period: DashboardPeriod
    ) {}
}
