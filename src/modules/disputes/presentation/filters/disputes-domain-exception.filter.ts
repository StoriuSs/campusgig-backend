import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'

import { ERROR_CODES, ERROR_TYPES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'

import {
    AlreadyRespondedException,
    DisputeAlreadyExistsException,
    DisputeNotFoundException,
    DisputeNotReviewableException,
    InvalidSplitPercentException,
    NotAParticipantException,
    NotDisputableStateException
} from '../../domain/exceptions'

@Catch(
    DisputeNotFoundException,
    DisputeAlreadyExistsException,
    NotDisputableStateException,
    AlreadyRespondedException,
    DisputeNotReviewableException,
    InvalidSplitPercentException,
    NotAParticipantException
)
export class DisputesDomainExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: PinoLogger) {}

    catch(exception: Error, host: ArgumentsHost): void {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<ExtendedRequest>()

        const { status, code, type, message } = this.mapException(exception)
        const duration = request.startTime ? Date.now() - request.startTime : undefined

        this.logger.warn(
            { method: request.method, url: request.url, statusCode: status, error: { message: exception.message } },
            'Disputes domain exception caught'
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
        if (exception instanceof DisputeNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.DISPUTE_NOT_FOUND,
                type: ERROR_TYPES.DISPUTE_NOT_FOUND,
                message: exception.message
            }
        }
        if (exception instanceof NotAParticipantException) {
            return {
                status: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.DISPUTE_NOT_A_PARTICIPANT,
                type: ERROR_TYPES.DISPUTE_NOT_A_PARTICIPANT,
                message: exception.message
            }
        }
        if (exception instanceof DisputeAlreadyExistsException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.DISPUTE_ALREADY_EXISTS,
                type: ERROR_TYPES.DISPUTE_ALREADY_EXISTS,
                message: exception.message
            }
        }
        if (exception instanceof NotDisputableStateException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.DISPUTE_NOT_DISPUTABLE,
                type: ERROR_TYPES.DISPUTE_NOT_DISPUTABLE,
                message: exception.message
            }
        }
        if (exception instanceof AlreadyRespondedException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.DISPUTE_ALREADY_RESPONDED,
                type: ERROR_TYPES.DISPUTE_ALREADY_RESPONDED,
                message: exception.message
            }
        }
        if (exception instanceof DisputeNotReviewableException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.DISPUTE_NOT_REVIEWABLE,
                type: ERROR_TYPES.DISPUTE_NOT_REVIEWABLE,
                message: exception.message
            }
        }
        if (exception instanceof InvalidSplitPercentException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.DISPUTE_INVALID_SPLIT,
                type: ERROR_TYPES.DISPUTE_INVALID_SPLIT,
                message: exception.message
            }
        }
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.BAD_REQUEST,
            type: ERROR_TYPES.BAD_REQUEST,
            message: 'An unexpected disputes error occurred'
        }
    }
}
