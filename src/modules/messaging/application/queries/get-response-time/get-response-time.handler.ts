import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort } from '../../../domain/ports'
import { GetResponseTimeQuery } from './get-response-time.query'

// Trailing window — long enough to smooth out a quiet week, short enough
// that a once-fast seller can't ride a year-old number.
const WINDOW_DAYS = 60
// Minimum samples to publish a number. Below this the median jitters too
// much to be honest — better to show nothing than a fake-precise figure.
const MIN_SAMPLES = 5

export type ResponseTimeBucket =
    | 'under_1h'
    | '1h'
    | '2h'
    | '3h'
    | '4h'
    | '5h'
    | '6h'
    | '7h'
    | '8h'
    | '9h'
    | '10h'
    | '11h'
    | '12h'
    | '13h'
    | '14h'
    | '15h'
    | '16h'
    | '17h'
    | '18h'
    | '19h'
    | '20h'
    | '21h'
    | '22h'
    | '23h'
    | 'within_1_day'
    | 'within_2_days'
    | 'over_2_days'
    | 'no_data'

export interface ResponseTimeResult {
    bucket: ResponseTimeBucket
    sampleCount: number
    windowDays: number
}

@QueryHandler(GetResponseTimeQuery)
export class GetResponseTimeHandler implements IQueryHandler<GetResponseTimeQuery> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    async execute(query: GetResponseTimeQuery): Promise<ResponseTimeResult> {
        const { medianSeconds, sampleCount } = await this.repo.getResponseTimeSamples(query.userId, WINDOW_DAYS)

        if (sampleCount < MIN_SAMPLES || medianSeconds == null) {
            return { bucket: 'no_data', sampleCount, windowDays: WINDOW_DAYS }
        }

        return {
            bucket: classify(medianSeconds),
            sampleCount,
            windowDays: WINDOW_DAYS
        }
    }
}

function classify(seconds: number): ResponseTimeBucket {
    // Round down to the nearest hour so a 1h 50m average reads as "1 hour"
    // rather than inflating to "2 hours". Mirrors Fiverr's honest-floor
    // convention.
    if (seconds < 3600) return 'under_1h'
    const hours = Math.floor(seconds / 3600)
    if (hours <= 23) return `${hours}h` as ResponseTimeBucket
    if (seconds < 48 * 3600) return 'within_1_day'
    if (seconds < 72 * 3600) return 'within_2_days'
    return 'over_2_days'
}
