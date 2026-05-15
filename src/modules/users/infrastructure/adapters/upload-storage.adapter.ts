import { Injectable } from '@nestjs/common'
import { UploadService } from '@/shared/infrastructure/storage/upload.service'
import { StoragePort, UploadedFileResult } from '@/modules/users/application'

/**
 * Upload Storage Adapter — Outbound Adapter
 *
 * Adapts the existing UploadService to the StoragePort interface.
 * The application layer uses StoragePort, which knows nothing about
 * Express, Multer, or the underlying storage implementation.
 */
@Injectable()
export class UploadStorageAdapter implements StoragePort {
    constructor(private readonly uploadService: UploadService) {}

    async uploadAvatar(fileBuffer: Buffer, originalName: string, userId: string): Promise<UploadedFileResult> {
        // Create a minimal file-like object for the existing UploadService
        const file = {
            buffer: fileBuffer,
            originalname: originalName,
            mimetype: 'image/webp' // Avatar processing converts to webp anyway
        } as Express.Multer.File

        const result = await this.uploadService.uploadAvatar(file, userId)

        return {
            key: result.key,
            path: result.path,
            width: result.width,
            height: result.height
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        await this.uploadService.deleteFile(filePath)
    }

    getPublicUrl(key: string): string {
        return this.uploadService.getPublicUrl(key)
    }
}
