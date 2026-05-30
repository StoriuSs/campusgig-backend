import { Inject, Injectable } from '@nestjs/common'
import { IStorageService, STORAGE_SERVICE } from '@/shared/infrastructure/storage/interfaces/storage.interface'
import { DeliveryStoragePort } from '../../domain/ports'

// Mirror of S3MessageAttachmentAdapter — same UploadModule provider, same
// charset + Content-Disposition helpers. Key prefix is `deliveries/...` so
// ops can grep for the lifecycle of every delivered file.
const DELIVERY_SUBDIR = 'deliveries'

@Injectable()
export class S3DeliveryFileAdapter implements DeliveryStoragePort {
    constructor(@Inject(STORAGE_SERVICE) private readonly storage: IStorageService) {}

    async upload(input: {
        orderId: string
        filename: string
        mime: string
        body: Buffer
    }): Promise<{ key: string; size: number }> {
        // Group by order so an ops-level cleanup of all deliveries for one
        // order is a single prefix wipe. Staged files (not yet linked to a
        // Delivery row) live under the same prefix; harmless.
        const subDirectory = `${DELIVERY_SUBDIR}/${input.orderId}`
        const ContentType = isTextMime(input.mime) ? `${input.mime}; charset=utf-8` : input.mime
        const uploaded = await this.storage.uploadBuffer(input.body, input.filename, ContentType, { subDirectory })
        return { key: uploaded.key, size: uploaded.size }
    }

    async presignGetUrl(key: string, ttlSeconds: number, downloadFilename?: string): Promise<string> {
        // Seeded deliveries use the picsum: prefix for demo files. Same
        // bypass pattern as messaging attachments.
        if (key.startsWith('picsum:')) {
            return key.slice('picsum:'.length)
        }
        if (/^https?:\/\//i.test(key)) return key
        return this.storage.getSignedReadUrl(key, {
            expiresIn: ttlSeconds,
            ...(downloadFilename ? { responseContentDisposition: buildContentDisposition(downloadFilename) } : {})
        })
    }

    async delete(key: string): Promise<void> {
        if (key.startsWith('picsum:')) return
        if (/^https?:\/\//i.test(key)) return
        await this.storage.deleteFile(key)
    }
}

function isTextMime(mime: string): boolean {
    return mime.startsWith('text/') || mime === 'application/json'
}

// RFC 6266: ASCII fallback + UTF-8 percent-encoded filename* so Vietnamese
// names download with the correct characters.
function buildContentDisposition(filename: string): string {
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
    const utf8Encoded = encodeURIComponent(filename)
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`
}
