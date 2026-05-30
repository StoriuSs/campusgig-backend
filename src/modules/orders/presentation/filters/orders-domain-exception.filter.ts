import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'

import { ERROR_CODES, ERROR_TYPES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'

import {
    DeclineNoteTooShortException,
    DeliveryFileTooLargeException,
    DeliveryNoteTooShortException,
    GigNotPurchasableException,
    InsufficientWalletBalanceException,
    InvalidTransitionException,
    NotAParticipantException,
    OrderNotFoundException,
    PendingCancellationAlreadyExistsException,
    PendingExtensionAlreadyExistsException,
    SellerCannotOrderOwnGigException,
    TooManyDeliveryFilesException,
    UnsupportedDeliveryFileTypeException
} from '../../domain/exceptions'

@Catch(
    OrderNotFoundException,
    NotAParticipantException,
    InvalidTransitionException,
    InsufficientWalletBalanceException,
    SellerCannotOrderOwnGigException,
    PendingExtensionAlreadyExistsException,
    PendingCancellationAlreadyExistsException,
    DeliveryNoteTooShortException,
    DeclineNoteTooShortException,
    GigNotPurchasableException,
    TooManyDeliveryFilesException,
    UnsupportedDeliveryFileTypeException,
    DeliveryFileTooLargeException
)
export class OrdersDomainExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: PinoLogger) {}

    catch(exception: Error, host: ArgumentsHost): void {
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
            'Orders domain exception caught'
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
        if (exception instanceof OrderNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.ORDER_NOT_FOUND,
                type: ERROR_TYPES.ORDER_NOT_FOUND,
                message: exception.message
            }
        }
        if (exception instanceof NotAParticipantException) {
            return {
                status: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.ORDERS_NOT_A_PARTICIPANT,
                type: ERROR_TYPES.ORDERS_NOT_A_PARTICIPANT,
                message: exception.message
            }
        }
        if (exception instanceof InvalidTransitionException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.ORDERS_INVALID_TRANSITION,
                type: ERROR_TYPES.ORDERS_INVALID_TRANSITION,
                message: exception.message
            }
        }
        if (exception instanceof InsufficientWalletBalanceException) {
            return {
                status: HttpStatus.UNPROCESSABLE_ENTITY,
                code: ERROR_CODES.ORDERS_INSUFFICIENT_WALLET_BALANCE,
                type: ERROR_TYPES.ORDERS_INSUFFICIENT_WALLET_BALANCE,
                message: exception.message
            }
        }
        if (exception instanceof SellerCannotOrderOwnGigException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.ORDERS_SELLER_CANNOT_ORDER_OWN_GIG,
                type: ERROR_TYPES.ORDERS_SELLER_CANNOT_ORDER_OWN_GIG,
                message: exception.message
            }
        }
        if (exception instanceof PendingExtensionAlreadyExistsException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.ORDERS_PENDING_EXTENSION_EXISTS,
                type: ERROR_TYPES.ORDERS_PENDING_EXTENSION_EXISTS,
                message: exception.message
            }
        }
        if (exception instanceof PendingCancellationAlreadyExistsException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.ORDERS_PENDING_CANCELLATION_EXISTS,
                type: ERROR_TYPES.ORDERS_PENDING_CANCELLATION_EXISTS,
                message: exception.message
            }
        }
        if (exception instanceof DeliveryNoteTooShortException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.ORDERS_DELIVERY_NOTE_TOO_SHORT,
                type: ERROR_TYPES.ORDERS_DELIVERY_NOTE_TOO_SHORT,
                message: exception.message
            }
        }
        if (exception instanceof DeclineNoteTooShortException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.ORDERS_DECLINE_NOTE_TOO_SHORT,
                type: ERROR_TYPES.ORDERS_DECLINE_NOTE_TOO_SHORT,
                message: exception.message
            }
        }
        if (exception instanceof GigNotPurchasableException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.ORDERS_GIG_NOT_PURCHASABLE,
                type: ERROR_TYPES.ORDERS_GIG_NOT_PURCHASABLE,
                message: exception.message
            }
        }
        if (exception instanceof TooManyDeliveryFilesException) {
            return {
                status: HttpStatus.UNPROCESSABLE_ENTITY,
                code: ERROR_CODES.ORDERS_TOO_MANY_DELIVERY_FILES,
                type: ERROR_TYPES.ORDERS_TOO_MANY_DELIVERY_FILES,
                message: exception.message
            }
        }
        if (exception instanceof UnsupportedDeliveryFileTypeException) {
            return {
                status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                code: ERROR_CODES.ORDERS_UNSUPPORTED_DELIVERY_FILE_TYPE,
                type: ERROR_TYPES.ORDERS_UNSUPPORTED_DELIVERY_FILE_TYPE,
                message: exception.message
            }
        }
        if (exception instanceof DeliveryFileTooLargeException) {
            return {
                status: HttpStatus.PAYLOAD_TOO_LARGE,
                code: ERROR_CODES.ORDERS_DELIVERY_FILE_TOO_LARGE,
                type: ERROR_TYPES.ORDERS_DELIVERY_FILE_TOO_LARGE,
                message: exception.message
            }
        }
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.BAD_REQUEST,
            type: ERROR_TYPES.BAD_REQUEST,
            message: 'An unexpected orders error occurred'
        }
    }
}
