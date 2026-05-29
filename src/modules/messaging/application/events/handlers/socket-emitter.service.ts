import { Injectable } from '@nestjs/common'
import { MessagingGateway } from '../../../presentation/ws/messaging.gateway'

// Thin wrapper around the gateway's server so event handlers don't import
// `socket.io` types directly. Mirrors the "thin adapter at the seam" pattern.
@Injectable()
export class SocketEmitter {
    constructor(private readonly gateway: MessagingGateway) {}

    emitToUser(userId: string, event: string, payload: unknown): void {
        this.gateway.server.to(this.gateway.userRoom(userId)).emit(event, payload)
    }

    emitToThread(threadId: string, event: string, payload: unknown): void {
        this.gateway.server.to(this.gateway.threadRoom(threadId)).emit(event, payload)
    }
}
