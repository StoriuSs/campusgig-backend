import { HttpStatus } from '@nestjs/common'
import { UsersDomainExceptionFilter } from './users-domain-exception.filter'
import {
    UserNotFoundException,
    UsernameTakenException,
    UsernameAlreadySetException,
    AvatarRequiredException
} from '@/modules/users/domain'

describe('UsersDomainExceptionFilter', () => {
    let filter: UsersDomainExceptionFilter
    let mockLogger: { warn: jest.Mock }
    let mockResponse: { status: jest.Mock; json: jest.Mock }
    let mockRequest: { method: string; url: string; startTime: number; requestId: string }
    let mockHost: {
        switchToHttp: () => { getResponse: () => typeof mockResponse; getRequest: () => typeof mockRequest }
    }

    beforeEach(() => {
        mockLogger = {
            warn: jest.fn()
        }

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        }

        mockRequest = {
            method: 'POST',
            url: '/api/v1/users/me/username',
            startTime: Date.now() - 50,
            requestId: 'req-123'
        }

        mockHost = {
            switchToHttp: () => ({
                getResponse: () => mockResponse,
                getRequest: () => mockRequest
            })
        }

        filter = new UsersDomainExceptionFilter(
            mockLogger as unknown as ConstructorParameters<typeof UsersDomainExceptionFilter>[0]
        )
    })

    it('should map UserNotFoundException to 404 NOT_FOUND', () => {
        const exception = new UserNotFoundException('user-123')

        filter.catch(exception, mockHost as unknown as Parameters<typeof filter.catch>[1])

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                meta: expect.objectContaining({
                    message: exception.message
                })
            })
        )
    })

    it('should map UsernameTakenException to 409 CONFLICT', () => {
        const exception = new UsernameTakenException('username')

        filter.catch(exception, mockHost as unknown as Parameters<typeof filter.catch>[1])

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT)
    })

    it('should map UsernameAlreadySetException to 400 BAD_REQUEST', () => {
        const exception = new UsernameAlreadySetException()

        filter.catch(exception, mockHost as unknown as Parameters<typeof filter.catch>[1])

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    })

    it('should map AvatarRequiredException to 400 BAD_REQUEST', () => {
        const exception = new AvatarRequiredException()

        filter.catch(exception, mockHost as unknown as Parameters<typeof filter.catch>[1])

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    })

    it('should include request metadata in the response', () => {
        const exception = new UserNotFoundException('user-123')

        filter.catch(exception, mockHost as unknown as Parameters<typeof filter.catch>[1])

        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    path: '/api/v1/users/me/username',
                    method: 'POST'
                }),
                meta: expect.objectContaining({
                    request_id: 'req-123'
                })
            })
        )
    })

    it('should log a warning for every caught exception', () => {
        const exception = new UsernameTakenException('username')

        filter.catch(exception, mockHost as unknown as Parameters<typeof filter.catch>[1])

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: HttpStatus.CONFLICT,
                requestId: 'req-123'
            }),
            'User domain exception caught'
        )
    })
})
