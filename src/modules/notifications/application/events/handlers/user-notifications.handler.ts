import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs'

import { UserEndorsedEvent } from '@/modules/users/application/events/user-endorsed.event'
import { EndorsementRevokedEvent } from '@/modules/users/application/events/endorsement-revoked.event'

import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

type UserEvent = UserEndorsedEvent | EndorsementRevokedEvent

@EventsHandler(UserEndorsedEvent, EndorsementRevokedEvent)
export class UserNotificationsHandler implements IEventHandler<UserEvent> {
    constructor(private readonly commandBus: CommandBus) {}

    handle(event: UserEvent): Promise<void> {
        const type = event instanceof UserEndorsedEvent ? 'endorsed' : 'endorsement_revoked'
        return this.commandBus.execute(new CreateNotificationCommand([event.userId], type, {}))
    }
}
