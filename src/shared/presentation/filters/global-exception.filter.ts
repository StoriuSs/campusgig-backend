import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'
import { ERROR_TYPES, ERROR_CODES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'
import { MetricsService } from '@/shared/infrastructure'
import { isMetricsRequest } from '@/shared/utils'

interface HttpExceptionResponse {
    message?: string | string[]
    errors?: unknown
    type?: string
    code?: string
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(
        private readonly logger: PinoLogger,
        private readonly metricsService: MetricsService
    ) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<ExtendedRequest>()

        let status = HttpStatus.BAD_REQUEST
        let message: string | string[] = 'Bad request'
        let errors: unknown = null

        if (exception instanceof HttpException) {
            status = exception.getStatus()
            const exceptionResponse = exception.getResponse()

            if (typeof exceptionResponse === 'object') {
                const httpExceptionResponse = exceptionResponse as HttpExceptionResponse
                message = httpExceptionResponse.message || exception.message
                errors = httpExceptionResponse.errors || null
            } else {
                message = exceptionResponse as string
            }
        } else if (exception instanceof Error) {
            message = exception.message
        }

        // Calculate request duration
        const startTime = request.startTime
        const duration = startTime ? Date.now() - startTime : undefined

        // Record error metrics (for errors that bypass the interceptor, e.g., guard errors)
        // Skip metrics for /metrics endpoint (Prometheus scraping)
        const path = this.normalizePath(request.route?.path || request.url)
        if (!isMetricsRequest(request.url)) {
            this.metricsService.recordRequest(request.method, path, status, duration || 0)
        }

        // Structured error logging
        this.logger.error(
            {
                method: request.method,
                url: request.url,
                statusCode: status,
                duration,
                requestId: request.requestId,
                error: {
                    message: Array.isArray(message) ? message.join('; ') : message,
                    stack: exception instanceof Error ? exception.stack : undefined
                }
            },
            'Exception caught'
        )

        // Prefer error code/type from exception response if present
        let errorType = ERROR_TYPES.BAD_REQUEST
        let errorCode = ERROR_CODES.BAD_REQUEST
        if (exception instanceof HttpException) {
            const exceptionResponse = exception.getResponse()
            if (typeof exceptionResponse === 'object') {
                const httpExceptionResponse = exceptionResponse as HttpExceptionResponse
                errorType = httpExceptionResponse.type || errorType
                errorCode = httpExceptionResponse.code || errorCode
            }

            // Check for throttle exception
            if (status === HttpStatus.TOO_MANY_REQUESTS) {
                errorType = ERROR_TYPES.THROTTLE
                errorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED
            }

            // Check for cors exception
            if (
                status === HttpStatus.FORBIDDEN &&
                message === "CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."
            ) {
                errorType = ERROR_TYPES.CORS
                errorCode = ERROR_CODES.CORS_ERROR
            }
        }

        // Send response
        const errorResponse = {
            meta: {
                code: errorCode,
                type: errorType,
                message: Array.isArray(message) ? message.join('; ') : message,
                timestamp: new Date().toISOString(),
                request_id: request.requestId,
                request_duration: duration
            },
            data: {
                details: errors || message,
                path: request.url,
                method: request.method,
                stack: exception instanceof Error ? exception.stack : undefined
            }
        }

        response.status(status).json(errorResponse)
    }

    /**
     * Normalize paths to avoid high cardinality metrics
     */
    private normalizePath(path: string): string {
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            .replace(/\/\d+/g, '/:id')
    }
}
