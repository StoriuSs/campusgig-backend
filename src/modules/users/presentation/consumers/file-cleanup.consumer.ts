import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { UploadService } from '@/shared/infrastructure/storage/upload.service'

/**
 * File Cleanup Consumer — Inbound Adapter
 *
 * Receives BullMQ jobs to delete files from storage.
 * This is an inbound adapter (like a controller, but for queue messages).
 */
@Processor('file-cleanup')
export class FileCleanupConsumer extends WorkerHost {
    private readonly logger = new Logger(FileCleanupConsumer.name)

    constructor(private readonly uploadService: UploadService) {
        super()
    }

    async process(job: Job<{ filePath: string }, void, string>): Promise<void> {
        const { filePath } = job.data
        this.logger.debug(`Processing file cleanup for: ${filePath}`)

        try {
            await this.uploadService.deleteFile(filePath)
            this.logger.debug(`Successfully deleted file: ${filePath}`)
        } catch (error) {
            this.logger.error(`Failed to delete file: ${filePath}`, (error as Error).stack)
            throw error // BullMQ will retry with exponential backoff
        }
    }
}
