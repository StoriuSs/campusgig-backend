import { Injectable } from '@nestjs/common'
import { UploadService } from '@/shared/infrastructure/storage/upload.service'
import { GigStoragePort, GigImageUploadResult } from '@/modules/gigs/application/ports'

@Injectable()
export class GigStorageAdapter implements GigStoragePort {
    constructor(private readonly uploadService: UploadService) {}

    async uploadGigImage(fileBuffer: Buffer, originalName: string, uploaderId: string): Promise<GigImageUploadResult> {
        const file = {
            buffer: fileBuffer,
            originalname: originalName,
            mimetype: 'image/jpeg' // sharp normalizes to WebP regardless
        } as Express.Multer.File

        const result = await this.uploadService.uploadGigImage(file, uploaderId)
        return {
            key: result.key,
            width: result.width ?? 0,
            height: result.height ?? 0
        }
    }

    async deleteFile(key: string): Promise<void> {
        await this.uploadService.deleteFile(key)
    }

    async getSignedReadUrl(key: string): Promise<string> {
        return this.uploadService.getSignedReadUrl(key)
    }
}
