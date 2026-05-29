import { Inject, Logger, OnModuleInit } from '@nestjs/common'
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer
} from '@nestjs/websockets'
import { EventBus } from '@nestjs/cqrs'
import type { Server, Socket } from 'socket.io'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort, PRESENCE_PORT, PresencePort } from '../../domain/ports'
import { PresenceChangedEvent } from '../../domain/events'
import { WsTokenAuthenticator } from './ws-token-authenticator.service'

// Stash userId on the socket via `socket.data.userId`. Typed for clarity.
interface AuthedSocket extends Socket {
    data: { userId?: string }
}

@WebSocketGateway({
    namespace: '/ws',
    cors: {
        origin: true,
        credentials: true
    }
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
    @WebSocketServer()
    server!: Server

    private readonly logger = new Logger(MessagingGateway.name)

    constructor(
        private readonly auth: WsTokenAuthenticator,
        @Inject(PRESENCE_PORT) private readonly presence: PresencePort,
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async onModuleInit(): Promise<void> {
        // Clear any sticky-online ghosts left over from a crash that didn't
        // give sockets a chance to disconnect cleanly.
        await this.presence.clearAll()
    }

    async handleConnection(client: AuthedSocket): Promise<void> {
        // Token can arrive in two places to be friendly to both
        // socket.io-client `auth` payload and raw header-based clients.
        const fromAuth = (client.handshake.auth as { token?: string } | undefined)?.token
        const fromHeader = this.extractBearer(client.handshake.headers.authorization as string | undefined)
        const token = fromAuth ?? fromHeader

        const userId = await this.auth.authenticate(token)
        if (!userId) {
            this.logger.debug(`WS reject: invalid/missing token (${client.id})`)
            client.disconnect()
            return
        }

        client.data.userId = userId
        await this.presence.markOnline(userId, client.id)
        await client.join(this.userRoom(userId))

        // Notify peers that this user came online.
        const peers = await this.repo.listThreadPeers(userId)
        this.eventBus.publish(new PresenceChangedEvent(userId, true, null, peers))
        this.logger.debug(`WS connect: user=${userId} socket=${client.id}`)
    }

    async handleDisconnect(client: AuthedSocket): Promise<void> {
        const userId = client.data.userId
        if (!userId) return

        const wasLast = await this.presence.markOffline(userId, client.id)
        if (wasLast) {
            const now = new Date()
            await this.repo.setLastSeen(userId, now)
            const peers = await this.repo.listThreadPeers(userId)
            this.eventBus.publish(new PresenceChangedEvent(userId, false, now, peers))
        }
        this.logger.debug(`WS disconnect: user=${userId} socket=${client.id}`)
    }

    // Client tells us "I'm looking at this thread now" — used so the gateway
    // can emit message:new and thread:read events into the thread room.
    @SubscribeMessage('thread:join')
    async onThreadJoin(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() body: { threadId: string }
    ): Promise<{ ok: boolean; error?: string }> {
        const userId = client.data.userId
        if (!userId) return { ok: false, error: 'unauthenticated' }
        const thread = await this.repo.getThreadById(body.threadId, userId)
        if (!thread) return { ok: false, error: 'forbidden' }
        await client.join(this.threadRoom(body.threadId))
        return { ok: true }
    }

    @SubscribeMessage('thread:leave')
    async onThreadLeave(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() body: { threadId: string }
    ): Promise<{ ok: boolean }> {
        await client.leave(this.threadRoom(body.threadId))
        return { ok: true }
    }

    // Helpers used by event handlers via the SocketEmitter wrapper.
    userRoom(userId: string): string {
        return `user:${userId}`
    }
    threadRoom(threadId: string): string {
        return `thread:${threadId}`
    }

    private extractBearer(header: string | undefined): string | undefined {
        if (!header) return undefined
        const [scheme, token] = header.split(' ')
        return scheme === 'Bearer' ? token : undefined
    }
}
