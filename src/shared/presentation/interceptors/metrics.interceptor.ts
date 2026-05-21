import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap, catchError } from 'rxjs/operators'
import { throwError } from 'rxjs'
import { MetricsService } from '@/shared/infrastructure'
import { isMetricsRequest, isHealthCheckRequest } from '@/shared/utils'

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
    constructor(private readonly metricsService: MetricsService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest()

        // Skip metrics for /metrics endpoint (Prometheus scraping)
        if (isMetricsRequest(request.url)) {
            return next.handle()
        }

        // Skip metrics for healthcheck endpoints. Docker probes /health/live
        // every 30s; recording it would inflate the 2xx counter, pull median
        // latency toward the trivial healthcheck handler, and make error
        // rate appear artificially close to 0%. Healthcheck status is
        // already observable via `docker inspect ... .State.Health.Status`,
        // so we don't lose any operational signal by filtering here.
        if (isHealthCheckRequest(request.url)) {
            return next.handle()
        }

        const startTime = Date.now()

        // Increment active requests
        this.metricsService.incrementActiveRequests()

        return next.handle().pipe(
            tap(() => {
                this.recordMetrics(context, startTime)
            }),
            catchError((error) => {
                // Get the actual error status code
                const statusCode = error instanceof HttpException ? error.getStatus() : 500
                this.recordMetrics(context, startTime, statusCode)
                return throwError(() => error)
            })
        )
    }

    private recordMetrics(context: ExecutionContext, startTime: number, errorStatusCode?: number) {
        const request = context.switchToHttp().getRequest()
        const response = context.switchToHttp().getResponse()
        const duration = Date.now() - startTime

        // Use error status if provided, otherwise use response status
        const statusCode = errorStatusCode ?? response.statusCode

        // Decrement active requests
        this.metricsService.decrementActiveRequests()

        // Record request metrics
        this.metricsService.recordRequest(
            request.method,
            this.normalizePath(request.route?.path || request.url),
            statusCode,
            duration
        )
    }

    /**
     * Normalize paths to avoid high cardinality metrics
     * Replaces dynamic segments with :id placeholder
     */
    private normalizePath(path: string): string {
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
            .replace(/\/\d+/g, '/:id') // Numeric IDs
    }
}
