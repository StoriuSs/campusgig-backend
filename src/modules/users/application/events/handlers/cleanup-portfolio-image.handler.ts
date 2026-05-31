import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PortfolioItemDeletedEvent } from '../portfolio-item-deleted.event'

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
