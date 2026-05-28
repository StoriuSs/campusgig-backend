import { Injectable, Inject } from '@nestjs/common'
import {
    IStorageService,
    UploadedFile,
    UploadOptions,
    SignedUrlOptions,
    STORAGE_SERVICE
} from './interfaces/storage.interface'
import { ImageProcessingService } from './services/image-processing.service'

export { UploadedFile, UploadOptions, SignedUrlOptions } from './interfaces/storage.interface'

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
     * Upload portfolio image with automatic processing (resize to max 1600×1200,
     * convert to WebP, strip EXIF). Same shape as uploadAvatar.
     */
    async uploadPortfolioItem(file: Express.Multer.File, userId: string): Promise<UploadedFile> {
        const buffer = file.buffer || (await this.getFileBuffer(file))
        const processed = await this.imageProcessingService.processPortfolioImage(buffer)

        const uploaded = await this.storageService.uploadBuffer(
            processed.buffer,
            `portfolio.${processed.format}`,
            `image/${processed.format}`,
            {
                subDirectory: 'portfolio',
                filenamePrefix: `portfolio-${userId}`
            }
        )

        return {
            ...uploaded,
            width: processed.width,
            height: processed.height
        }
    }

    /**
     * Upload a gig image with automatic processing (resize to max 1600×1200,
     * convert to WebP, strip EXIF). Reuses the portfolio image processing
     * pipeline — same constraints, different S3 subdirectory.
     */
    async uploadGigImage(file: Express.Multer.File, uploaderId: string): Promise<UploadedFile> {
        const buffer = file.buffer || (await this.getFileBuffer(file))
        const processed = await this.imageProcessingService.processPortfolioImage(buffer)

        const uploaded = await this.storageService.uploadBuffer(
            processed.buffer,
            `gig.${processed.format}`,
            `image/${processed.format}`,
            {
                subDirectory: 'gigs',
                filenamePrefix: `gig-${uploaderId}`
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
     * Get a time-limited signed URL for reading a private file. See
     * IStorageService.getSignedReadUrl for full semantics. Use this for
     * any object stored in a private bucket; raw S3 URLs return 403.
     *
     * Passthrough for absolute http(s) URLs: some columns (seeded data, future
     * external image sources) store a full URL where an S3 object key would
     * normally go. Signing those would produce a broken bucket URL, so we
     * return them as-is.
     */
    async getSignedReadUrl(filePath: string, options?: SignedUrlOptions): Promise<string> {
        if (/^https?:\/\//i.test(filePath)) return filePath
        return this.storageService.getSignedReadUrl(filePath, options)
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
