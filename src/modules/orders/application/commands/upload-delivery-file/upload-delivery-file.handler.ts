import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import {
    DELIVERY_STORAGE_PORT,
    DeliveryFileItem,
    DeliveryStoragePort,
    OrdersRepositoryPort,
    ORDERS_REPOSITORY_PORT
} from '../../../domain/ports'
import {
    DeliveryFileTooLargeException,
    NotAParticipantException,
    UnsupportedDeliveryFileTypeException
} from '../../../domain/exceptions'
import { UploadDeliveryFileCommand } from './upload-delivery-file.command'

const MAX_DELIVERY_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME = new Set([
    // images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    // docs
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/csv',
    'text/markdown',
    // archives
    'application/zip',
    'application/x-zip-compressed'
])

@CommandHandler(UploadDeliveryFileCommand)
export class UploadDeliveryFileHandler implements ICommandHandler<UploadDeliveryFileCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        @Inject(DELIVERY_STORAGE_PORT)
        private readonly storage: DeliveryStoragePort
    ) {}

    async execute(command: UploadDeliveryFileCommand): Promise<DeliveryFileItem> {
        // Authorize seller for this order — uses the same viewer guard the
        // workspace queries use, then checks the seller-only condition.
        const order = await this.repo.findByIdForViewer(command.orderId, command.viewerId)
        if (!order || order.seller.id !== command.viewerId) {
            throw new NotAParticipantException(command.orderId, command.viewerId)
        }

        if (!ALLOWED_MIME.has(command.mime)) {
            throw new UnsupportedDeliveryFileTypeException(command.mime)
        }
        if (command.body.byteLength > MAX_DELIVERY_FILE_BYTES) {
            throw new DeliveryFileTooLargeException(command.body.byteLength, MAX_DELIVERY_FILE_BYTES)
        }

        const { key, size } = await this.storage.upload({
            orderId: command.orderId,
            filename: command.filename,
            mime: command.mime,
            body: command.body
        })

        return this.repo.stageDeliveryFile({
            sellerId: command.viewerId,
            orderId: command.orderId,
            key,
            name: command.filename,
            size,
            mime: command.mime
        })
    }
}
