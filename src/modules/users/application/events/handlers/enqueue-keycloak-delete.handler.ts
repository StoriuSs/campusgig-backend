import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { AccountDeletedEvent } from '../account-deleted.event'

@EventsHandler(AccountDeletedEvent)
export class EnqueueKeycloakDeleteHandler implements IEventHandler<AccountDeletedEvent> {
    private readonly logger = new Logger(EnqueueKeycloakDeleteHandler.name)

    constructor(@InjectQueue('keycloak-sync') private readonly keycloakQueue: Queue) {}

    async handle(event: AccountDeletedEvent): Promise<void> {
        try {
            await this.keycloakQueue.add(
                'hard-delete',
                { keycloakId: event.keycloakId, dbId: event.userId },
                {
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 5000 },
                    removeOnComplete: true
                }
            )
        } catch (error) {
            this.logger.error(`Failed to enqueue Keycloak hard delete for user ${event.keycloakId}`, error)
        }
    }
}
