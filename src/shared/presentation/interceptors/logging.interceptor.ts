import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Logger } from 'nestjs-pino'
import { ExtendedRequest } from '@/shared/types'
import { isMetricsRequest } from '@/shared/utils'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(private readonly logger: Logger) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const ctx = context.switchToHttp()
        const request = ctx.getRequest<ExtendedRequest>()
        const { method, url } = request

        // Skip logging for /metrics endpoint (Prometheus scraping)
        if (isMetricsRequest(url)) {
            return next.handle()
        }

        const requestId = request.requestId
        const startTime = request.startTime || Date.now()

        // Don't log the incoming request - too verbose
        // this.logger.log(`→ ${method} ${url}`)

        return next.handle().pipe(
            tap({
                next: () => {
                    const response = ctx.getResponse()
                    const duration = Date.now() - startTime
                    const statusCode = response.statusCode

                    // Structured logging for successful responses
                    this.logger.log(
                        {
                            method,
                            url,
                            statusCode,
                            duration,
                            requestId
                        },
                        'Request completed'
                    )
                }
            })
        )
    }
}
