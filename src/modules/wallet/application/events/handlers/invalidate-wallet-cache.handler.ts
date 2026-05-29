import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { Inject, Logger } from '@nestjs/common'
import { EventsHandler, IEventHandler } from '@nestjs/cqrs'

import {
    DepositCompletedEvent,
    WithdrawalApprovedEvent,
    WithdrawalRejectedEvent,
    WithdrawalRequestedEvent
} from '../../../domain/events'

type WalletEvent = DepositCompletedEvent | WithdrawalRequestedEvent | WithdrawalApprovedEvent | WithdrawalRejectedEvent

@EventsHandler(DepositCompletedEvent, WithdrawalRequestedEvent, WithdrawalApprovedEvent, WithdrawalRejectedEvent)
export class InvalidateWalletCacheHandler implements IEventHandler<WalletEvent> {
    private readonly logger = new Logger(InvalidateWalletCacheHandler.name)

    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    async handle(event: WalletEvent): Promise<void> {
        const key = `wallet:${event.userId}`
        try {
            await this.cache.del(key)
        } catch (err) {
            this.logger.warn(`Failed to invalidate ${key}: ${(err as Error).message}`)
        }
    }
}
