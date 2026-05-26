import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PortfolioItemDeletedEvent } from '../portfolio-item-deleted.event'

/**
 * Event Handler: Cleanup Portfolio Image
 *
 * Mirrors CleanupOldAvatarHandler. Reacts to PortfolioItemDeleted events by
 * enqueuing a BullMQ job to delete the S3 object. The FileCleanupConsumer
 * picks it up and performs the actual storage deletion.
 *
 * Fire-and-forget — failures are logged but don't propagate, since the DB
 * row is already deleted at this point and re-failing wouldn't undo that.
 * BullMQ's exponential backoff (configured below) covers transient S3 outages.
 */
@EventsHandler(PortfolioItemDeletedEvent)
export class CleanupPortfolioImageHandler implements IEventHandler<PortfolioItemDeletedEvent> {
    private readonly logger = new Logger(CleanupPortfolioImageHandler.name)

    constructor(@InjectQueue('file-cleanup') private readonly cleanupQueue: Queue) {}

    async handle(event: PortfolioItemDeletedEvent): Promise<void> {
        try {
            await this.cleanupQueue.add(
                'delete-portfolio-image',
                { filePath: event.imageKey },
                {
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 5000 },
                    removeOnComplete: true
                }
            )
        } catch (error) {
            this.logger.error('Failed to enqueue portfolio image deletion', error)
        }
    }
}
