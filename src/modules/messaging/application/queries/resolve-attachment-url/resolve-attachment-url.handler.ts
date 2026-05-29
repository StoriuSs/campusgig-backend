import { Inject, NotFoundException } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import {
    MESSAGING_REPOSITORY_PORT,
    MessagingRepositoryPort,
    MESSAGE_ATTACHMENT_STORAGE_PORT,
    MessageAttachmentStoragePort
} from '../../../domain/ports'
import { ResolveAttachmentUrlQuery } from './resolve-attachment-url.query'

// Presigned URL TTL — short to limit leak window if the link is shared.
const PRESIGN_TTL_SECONDS = 600

@QueryHandler(ResolveAttachmentUrlQuery)
export class ResolveAttachmentUrlHandler implements IQueryHandler<ResolveAttachmentUrlQuery> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort,
        @Inject(MESSAGE_ATTACHMENT_STORAGE_PORT)
        private readonly storage: MessageAttachmentStoragePort
    ) {}

    async execute(query: ResolveAttachmentUrlQuery): Promise<{ url: string; expiresAt: Date }> {
        const attachment = await this.repo.getAttachmentForResolve(query.attachmentId, query.viewerId)
        if (!attachment) {
            // Repo returns null for both "doesn't exist" and "not authorized".
            // We collapse to 404 to avoid leaking existence.
            throw new NotFoundException('Attachment not found')
        }

        const url = await this.storage.presignGetUrl(
            attachment.key,
            PRESIGN_TTL_SECONDS,
            query.forDownload ? attachment.name : undefined
        )
        const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000)
        return { url, expiresAt }
    }
}
