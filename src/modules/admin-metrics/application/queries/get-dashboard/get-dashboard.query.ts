import { RevenuePeriod } from '../../../domain/ports/admin-metrics.repository.port'

export class GetDashboardQuery {
    constructor(public readonly period: RevenuePeriod) {}
}
