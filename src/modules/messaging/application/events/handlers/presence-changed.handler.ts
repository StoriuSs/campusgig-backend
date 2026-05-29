import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { PresenceChangedEvent } from '../../../domain/events'
import { SocketEmitter } from './socket-emitter.service'

@EventsHandler(PresenceChangedEvent)
export class PresenceChangedSocketHandler implements IEventHandler<PresenceChangedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}

    handle(event: PresenceChangedEvent): void {
        const payload = {
            userId: event.userId,
            online: event.online,
            lastSeenAt: event.lastSeenAt ? event.lastSeenAt.toISOString() : null
        }
        for (const peerId of event.notifyUserIds) {
            this.emitter.emitToUser(peerId, 'presence:update', payload)
        }
    }
}
