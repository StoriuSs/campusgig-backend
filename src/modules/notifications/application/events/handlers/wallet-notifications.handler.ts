import { Inject } from '@nestjs/common'
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs'

import { WithdrawalRequestedEvent } from '@/modules/wallet/domain/events'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

@EventsHandler(WithdrawalRequestedEvent)
export class WalletNotificationsHandler implements IEventHandler<WithdrawalRequestedEvent> {
    constructor(
        private readonly commandBus: CommandBus,
        @Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort
    ) {}

    async handle(event: WithdrawalRequestedEvent): Promise<void> {
        const adminIds = await this.repo.findAdminIds()
        if (adminIds.length === 0) return
        const requesterName = (await this.repo.findDisplayName(event.userId)) ?? 'A user'
        await this.commandBus.execute(
            new CreateNotificationCommand(adminIds, 'admin_withdrawal_requested', {
                withdrawalId: event.withdrawalRequestId,
                amountVnd: event.amountVnd,
                requesterName
            })
        )
    }
}
