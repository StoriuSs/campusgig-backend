import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import {
    MESSAGING_REPOSITORY_PORT,
    MessagingRepositoryPort,
    MESSAGE_ATTACHMENT_STORAGE_PORT,
    MessageAttachmentStoragePort,
    StagedAttachment
} from '../../../domain/ports'
import {
    AttachmentTooLargeException,
    NotAThreadParticipantException,
    UnsupportedAttachmentTypeException
} from '../../../domain/exceptions'
import { UploadAttachmentCommand } from './upload-attachment.command'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/msword', // .doc (older)
    'application/vnd.ms-excel', // .xls (older)
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
])

@CommandHandler(UploadAttachmentCommand)
export class UploadAttachmentHandler implements ICommandHandler<UploadAttachmentCommand> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort,
        @Inject(MESSAGE_ATTACHMENT_STORAGE_PORT)
        private readonly storage: MessageAttachmentStoragePort
    ) {}

    async execute(command: UploadAttachmentCommand): Promise<StagedAttachment> {
        const thread = await this.repo.getThreadById(command.threadId, command.viewerId)
        if (!thread) {
            throw new NotAThreadParticipantException(command.threadId, command.viewerId)
        }

        if (!ALLOWED_MIME.has(command.mime)) {
            throw new UnsupportedAttachmentTypeException(command.mime)
        }
        if (command.body.byteLength > MAX_ATTACHMENT_BYTES) {
            throw new AttachmentTooLargeException(command.body.byteLength, MAX_ATTACHMENT_BYTES)
        }

        const { key, size } = await this.storage.upload({
            threadId: command.threadId,
            filename: command.filename,
            mime: command.mime,
            body: command.body
        })

        return this.repo.stageAttachment({
            senderId: command.viewerId,
            key,
            name: command.filename,
            size,
            mime: command.mime
        })
    }
}
