import { Inject, Injectable } from '@nestjs/common'
import { IStorageService, STORAGE_SERVICE } from '@/shared/infrastructure/storage/interfaces/storage.interface'
import { MessageAttachmentStoragePort } from '../../domain/ports'

// Key prefix under the shared upload directory. Mirrors the "gigs/..." pattern
// used by GigStorageAdapter so ops can grep for "messages/" to find all
// chat-uploaded files.
const ATTACHMENT_SUBDIR = 'message-attachments'

@Injectable()
export class S3MessageAttachmentAdapter implements MessageAttachmentStoragePort {
    constructor(@Inject(STORAGE_SERVICE) private readonly storage: IStorageService) {}

    async upload(input: {
        threadId: string
        filename: string
        mime: string
        body: Buffer
    }): Promise<{ key: string; size: number }> {
        // Group by thread so an ops-level cleanup of an entire conversation
        // is a single prefix wipe.
        const subDirectory = `${ATTACHMENT_SUBDIR}/${input.threadId}`
        // Text-flavored files need an explicit charset for the browser to
        // render Vietnamese / CJK / accented characters correctly when the
        // S3 link is opened directly. Without it, browsers default to
        // Latin-1 / Windows-1252 and the text shows up as mojibake.
        const ContentType = isTextMime(input.mime) ? `${input.mime}; charset=utf-8` : input.mime
        const uploaded = await this.storage.uploadBuffer(input.body, input.filename, ContentType, { subDirectory })
        return { key: uploaded.key, size: uploaded.size }
    }

    async presignGetUrl(key: string, ttlSeconds: number, downloadFilename?: string): Promise<string> {
        // Seed bypass — seeded attachments use a sentinel `picsum:<url>` key
        // so the seed script doesn't have to push real bytes to S3.
        if (key.startsWith('picsum:')) {
            return key.slice('picsum:'.length)
        }
        if (/^https?:\/\//i.test(key)) return key
        return this.storage.getSignedReadUrl(key, {
            expiresIn: ttlSeconds,
            ...(downloadFilename
                ? {
                      responseContentDisposition: buildContentDisposition(downloadFilename)
                  }
                : {})
        })
    }

    async delete(key: string): Promise<void> {
        if (key.startsWith('picsum:')) return
        if (/^https?:\/\//i.test(key)) return
        await this.storage.deleteFile(key)
    }
}

function isTextMime(mime: string): boolean {
    // text/plain, text/csv, text/markdown, application/json — all benefit
    // from an explicit charset for non-ASCII content.
    return mime.startsWith('text/') || mime === 'application/json'
}

// RFC 6266: ASCII fallback + UTF-8 percent-encoded filename* so Vietnamese
// names download with the correct characters across browsers.
function buildContentDisposition(filename: string): string {
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
    const utf8Encoded = encodeURIComponent(filename)
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`
}
