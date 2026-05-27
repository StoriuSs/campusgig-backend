import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'
import { ERROR_TYPES, ERROR_CODES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'
import {
    GigNotFoundException,
    InvalidGigStatusTransitionException,
    GigImageCapReachedException,
    GigBulletCapReachedException,
    GigFaqCapReachedException,
    ImageNotOwnedException,
    AdminCannotCreateGigException,
    CategoryNotFoundForGigException,
    GigLockedForReviewException,
    GigNotPendingException
} from '@/modules/gigs/domain'

@Catch(
    GigNotFoundException,
    InvalidGigStatusTransitionException,
    GigImageCapReachedException,
    GigBulletCapReachedException,
    GigFaqCapReachedException,
    ImageNotOwnedException,
    AdminCannotCreateGigException,
    CategoryNotFoundForGigException,
    GigLockedForReviewException,
    GigNotPendingException
)
export class GigsDomainExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: PinoLogger) {}

    catch(exception: Error, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<ExtendedRequest>()

        const { status, code, type, message } = this.mapException(exception)

        const startTime = request.startTime
        const duration = startTime ? Date.now() - startTime : undefined

        this.logger.warn(
            {
                method: request.method,
                url: request.url,
                statusCode: status,
                duration,
                requestId: request.requestId,
                error: { message: exception.message }
            },
            'Gig domain exception caught'
        )

        response.status(status).json({
            meta: {
                code,
                type,
                message,
                timestamp: new Date().toISOString(),
                request_id: request.requestId,
                request_duration: duration
            },
            data: {
                details: message,
                path: request.url,
                method: request.method
            }
        })
    }

    private mapException(exception: Error): {
        status: number
        code: string
        type: string
        message: string
    } {
        if (exception instanceof GigNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.GIG_NOT_FOUND,
                type: ERROR_TYPES.GIG_NOT_FOUND,
                message: exception.message
            }
        }
        if (exception instanceof InvalidGigStatusTransitionException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.GIG_INVALID_STATUS_TRANSITION,
                type: ERROR_TYPES.GIG_INVALID_STATUS_TRANSITION,
                message: exception.message
            }
        }
        if (exception instanceof GigImageCapReachedException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.GIG_IMAGE_CAP_REACHED,
                type: ERROR_TYPES.GIG_IMAGE_CAP_REACHED,
                message: exception.message
            }
        }
        if (exception instanceof GigBulletCapReachedException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.GIG_BULLET_CAP_REACHED,
                type: ERROR_TYPES.GIG_BULLET_CAP_REACHED,
                message: exception.message
            }
        }
        if (exception instanceof GigFaqCapReachedException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.GIG_FAQ_CAP_REACHED,
                type: ERROR_TYPES.GIG_FAQ_CAP_REACHED,
                message: exception.message
            }
        }
        if (exception instanceof ImageNotOwnedException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.GIG_IMAGE_NOT_OWNED,
                type: ERROR_TYPES.GIG_IMAGE_NOT_OWNED,
                message: exception.message
            }
        }
        if (exception instanceof AdminCannotCreateGigException) {
            return {
                status: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.GIG_ADMIN_CANNOT_CREATE,
                type: ERROR_TYPES.GIG_ADMIN_CANNOT_CREATE,
                message: exception.message
            }
        }
        if (exception instanceof CategoryNotFoundForGigException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.GIG_CATEGORY_NOT_FOUND,
                type: ERROR_TYPES.GIG_CATEGORY_NOT_FOUND,
                message: exception.message
            }
        }
        if (exception instanceof GigLockedForReviewException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.GIG_LOCKED_FOR_REVIEW,
                type: ERROR_TYPES.GIG_LOCKED_FOR_REVIEW,
                message: exception.message
            }
        }
        if (exception instanceof GigNotPendingException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.GIG_NOT_PENDING,
                type: ERROR_TYPES.GIG_NOT_PENDING,
                message: exception.message
            }
        }
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.BAD_REQUEST,
            type: ERROR_TYPES.BAD_REQUEST,
            message: 'An unexpected error occurred'
        }
    }
}
