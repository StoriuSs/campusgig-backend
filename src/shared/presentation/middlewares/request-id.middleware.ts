import { Injectable, NestMiddleware } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Response, NextFunction } from 'express'
import { ExtendedRequest } from '@/shared/types'

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
    use(req: ExtendedRequest, res: Response, next: NextFunction) {
        // Check if client already sent a requestId header
        const requestId = req.headers['x-request-id'] || uuidv4()

        // Attach requestId to request object
        req.requestId = requestId as string

        // Start tracking request duration
        const startTime = Date.now()
        req.startTime = startTime

        // Also attach it to response header for easier debugging
        res.setHeader('x-request-id', requestId)

        next()
    }
}
