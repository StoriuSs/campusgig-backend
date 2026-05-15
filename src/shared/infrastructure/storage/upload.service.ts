import { Injectable, Inject } from '@nestjs/common'
import { IStorageService, UploadedFile, UploadOptions, STORAGE_SERVICE } from './interfaces/storage.interface'
import { ImageProcessingService } from './services/image-processing.service'

export { UploadedFile, UploadOptions } from './interfaces/storage.interface'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']

/**
 * UploadService - Handles file uploads with optional image processing
 */
@Injectable()
export class UploadService {
    constructor(
        @Inject(STORAGE_SERVICE)
        private readonly storageService: IStorageService,
        private readonly imageProcessingService: ImageProcessingService
    ) {}

    /**
     * Upload a file with optional image processing
     */
    async uploadFile(file: Express.Multer.File, options?: UploadOptions): Promise<UploadedFile> {
        const isImage = IMAGE_MIME_TYPES.includes(file.mimetype)
        const shouldProcess = isImage && options?.imageProcessing

        if (!shouldProcess) {
            return this.storageService.uploadFile(file, options)
        }

        // Process image with Sharp
        const buffer = file.buffer || (await this.getFileBuffer(file))
        const processed = await this.imageProcessingService.processImage(buffer, options.imageProcessing)

        const extension = processed.format
        const newFilename = `${file.originalname.split('.')[0]}.${extension}`

        const uploaded = await this.storageService.uploadBuffer(
            processed.buffer,
            newFilename,
            `image/${extension}`,
            options
        )

        return {
            ...uploaded,
            width: processed.width,
            height: processed.height
        }
    }

    /**
     * Upload avatar with automatic processing (resize to 512x512, convert to WebP)
     */
    async uploadAvatar(file: Express.Multer.File, userId: string): Promise<UploadedFile> {
        const buffer = file.buffer || (await this.getFileBuffer(file))
        const processed = await this.imageProcessingService.processAvatar(buffer)

        const uploaded = await this.storageService.uploadBuffer(
            processed.buffer,
            `avatar.${processed.format}`,
            `image/${processed.format}`,
            {
                subDirectory: 'avatars',
                filenamePrefix: `avatar-${userId}`
            }
        )

        return {
            ...uploaded,
            width: processed.width,
            height: processed.height
        }
    }

    /**
     * Delete a file from storage
     */
    async deleteFile(filePath: string): Promise<void> {
        return this.storageService.deleteFile(filePath)
    }

    /**
     * Get a file from storage
     */
    async getFile(filePath: string): Promise<Buffer> {
        return this.storageService.getFile(filePath)
    }

    /**
     * Check if a file exists
     */
    async fileExists(filePath: string): Promise<boolean> {
        return this.storageService.fileExists(filePath)
    }

    /**
     * Get the public URL for a file relative key
     */
    getPublicUrl(filePath: string): string {
        return this.storageService.getPublicUrl(filePath)
    }

    /**
     * Validate if file is a valid image
     */
    async isValidImage(file: Express.Multer.File): Promise<boolean> {
        const buffer = file.buffer || (await this.getFileBuffer(file))
        return this.imageProcessingService.isValidImage(buffer)
    }

    private async getFileBuffer(file: Express.Multer.File): Promise<Buffer> {
        if (file.buffer) return file.buffer
        if (file.path) {
            const { promises: fs } = await import('fs')
            return fs.readFile(file.path)
        }
        throw new Error('Invalid file object')
    }
}
