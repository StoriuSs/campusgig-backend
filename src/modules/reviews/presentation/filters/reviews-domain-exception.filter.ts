import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'

import { ERROR_CODES, ERROR_TYPES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'

import {
    GigNotActiveForReplyException,
    NotTheBuyerException,
    NotTheSellerException,
    OrderNotCompletedException,
    ReplyAlreadyExistsException,
    ReviewAlreadyExistsException,
    ReviewNotFoundException
} from '../../domain/exceptions'

@Catch(
    ReviewNotFoundException,
    ReviewAlreadyExistsException,
    OrderNotCompletedException,
    NotTheBuyerException,
    ReplyAlreadyExistsException,
    GigNotActiveForReplyException,
    NotTheSellerException
)
export class ReviewsDomainExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: PinoLogger) {}

    catch(exception: Error, host: ArgumentsHost): void {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<ExtendedRequest>()

        const { status, code, type, message } = this.mapException(exception)
        const duration = request.startTime ? Date.now() - request.startTime : undefined

        this.logger.warn(
            {
                method: request.method,
                url: request.url,
                statusCode: status,
                duration,
                requestId: request.requestId,
                error: { message: exception.message }
            },
            'Reviews domain exception caught'
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
            data: { details: message, path: request.url, method: request.method }
        })
    }

    private mapException(exception: Error): { status: number; code: string; type: string; message: string } {
        if (exception instanceof ReviewNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.REVIEW_NOT_FOUND,
                type: ERROR_TYPES.REVIEW_NOT_FOUND,
                message: exception.message
            }
        }
        if (exception instanceof NotTheBuyerException) {
            return {
                status: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.REVIEW_NOT_THE_BUYER,
                type: ERROR_TYPES.REVIEW_NOT_THE_BUYER,
                message: exception.message
            }
        }
        if (exception instanceof NotTheSellerException) {
            return {
                status: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.REVIEW_NOT_THE_SELLER,
                type: ERROR_TYPES.REVIEW_NOT_THE_SELLER,
                message: exception.message
            }
        }
        if (exception instanceof ReviewAlreadyExistsException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
                type: ERROR_TYPES.REVIEW_ALREADY_EXISTS,
                message: exception.message
            }
        }
        if (exception instanceof ReplyAlreadyExistsException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.REVIEW_REPLY_ALREADY_EXISTS,
                type: ERROR_TYPES.REVIEW_REPLY_ALREADY_EXISTS,
                message: exception.message
            }
        }
        if (exception instanceof GigNotActiveForReplyException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.REVIEW_GIG_NOT_ACTIVE,
                type: ERROR_TYPES.REVIEW_GIG_NOT_ACTIVE,
                message: exception.message
            }
        }
        if (exception instanceof OrderNotCompletedException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.REVIEW_ORDER_NOT_COMPLETED,
                type: ERROR_TYPES.REVIEW_ORDER_NOT_COMPLETED,
                message: exception.message
            }
        }
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.BAD_REQUEST,
            type: ERROR_TYPES.BAD_REQUEST,
            message: 'An unexpected reviews error occurred'
        }
    }
}
