import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { AvatarUploadedEvent } from '../avatar-uploaded.event'

@EventsHandler(AvatarUploadedEvent)
export class CleanupOldAvatarHandler implements IEventHandler<AvatarUploadedEvent> {
    private readonly logger = new Logger(CleanupOldAvatarHandler.name)

    constructor(@InjectQueue('file-cleanup') private readonly cleanupQueue: Queue) {}

    async handle(event: AvatarUploadedEvent): Promise<void> {
        // Strip legacy URL prefix that predates the key-only storage convention.
        const filePath = event.previousAvatarUrl.includes('uploads/')
            ? event.previousAvatarUrl.split('uploads/')[1]
            : event.previousAvatarUrl

        try {
            await this.cleanupQueue.add(
                'delete-avatar',
                { filePath },
                {
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 5000 },
                    removeOnComplete: true
                }
            )
        } catch (error) {
            this.logger.error('Failed to enqueue avatar deletion', error)
        }
    }
}
