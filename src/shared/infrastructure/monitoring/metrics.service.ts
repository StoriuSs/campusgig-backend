import { Injectable } from '@nestjs/common'
import { Counter, Histogram, Gauge } from 'prom-client'
import { InjectMetric } from '@willsoto/nestjs-prometheus'

@Injectable()
export class MetricsService {
    constructor(
        @InjectMetric('http_requests_total')
        public readonly httpRequestsTotal: Counter<string>,

        @InjectMetric('http_request_duration_seconds')
        public readonly httpRequestDuration: Histogram<string>,

        @InjectMetric('http_active_requests')
        public readonly httpActiveRequests: Gauge<string>,

        @InjectMetric('db_query_duration_seconds')
        public readonly dbQueryDuration: Histogram<string>,

        @InjectMetric('db_queries_total')
        public readonly dbQueriesTotal: Counter<string>,

        @InjectMetric('cache_hits_total')
        public readonly cacheHits: Counter<string>,

        @InjectMetric('cache_misses_total')
        public readonly cacheMisses: Counter<string>
    ) {}

    /**
     * Record an HTTP request metric
     */
    recordRequest(method: string, path: string, statusCode: number, duration: number) {
        this.httpRequestsTotal.inc({
            method,
            path,
            status_code: String(statusCode)
        })

        this.httpRequestDuration.observe({ method, path }, duration / 1000) // Convert ms to seconds
    }

    /**
     * Increment active request count
     */
    incrementActiveRequests() {
        this.httpActiveRequests.inc()
    }

    /**
     * Decrement active request count
     */
    decrementActiveRequests() {
        this.httpActiveRequests.dec()
    }

    /**
     * Record a database query metric
     */
    recordDbQuery(operation: string, durationMs: number) {
        this.dbQueriesTotal.inc({ operation })
        this.dbQueryDuration.observe({ operation }, durationMs / 1000)
    }

    /**
     * Record a cache hit
     */
    recordCacheHit() {
        this.cacheHits.inc()
    }

    /**
     * Record a cache miss
     */
    recordCacheMiss() {
        this.cacheMisses.inc()
    }
}
