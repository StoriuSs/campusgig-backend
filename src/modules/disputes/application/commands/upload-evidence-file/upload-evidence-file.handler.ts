import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import {
    DELIVERY_STORAGE_PORT,
    DeliveryStoragePort,
    ORDERS_REPOSITORY_PORT,
    OrdersRepositoryPort
} from '@/modules/orders/domain/ports'
import { DeliveryFileTooLargeException, UnsupportedDeliveryFileTypeException } from '@/modules/orders/domain/exceptions'

import {
    DISPUTES_REPOSITORY_PORT,
    DisputeEvidenceItem,
    DisputesRepositoryPort
} from '../../../domain/ports/disputes.repository.port'
import { DisputeParty } from '../../../domain/dispute.types'
import { NotAParticipantException } from '../../../domain/exceptions'
import { UploadEvidenceFileCommand } from './upload-evidence-file.command'

// Mirror the delivery-file limits (SRS: dispute evidence reuses the same infra).
const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024
const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
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
    'application/zip',
    'application/x-zip-compressed'
])

@CommandHandler(UploadEvidenceFileCommand)
export class UploadEvidenceFileHandler implements ICommandHandler<UploadEvidenceFileCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT) private readonly ordersRepo: OrdersRepositoryPort,
        @Inject(DELIVERY_STORAGE_PORT) private readonly storage: DeliveryStoragePort,
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort
    ) {}

    async execute(command: UploadEvidenceFileCommand): Promise<DisputeEvidenceItem> {
        const order = await this.ordersRepo.findByIdForViewer(command.orderId, command.viewerId)
        if (!order) throw new NotAParticipantException(command.orderId)

        if (!ALLOWED_MIME.has(command.mime)) throw new UnsupportedDeliveryFileTypeException(command.mime)
        if (command.body.byteLength > MAX_EVIDENCE_FILE_BYTES) {
            throw new DeliveryFileTooLargeException(command.body.byteLength, MAX_EVIDENCE_FILE_BYTES)
        }

        const side: DisputeParty = order.buyer.id === command.viewerId ? 'Buyer' : 'Seller'
        const { key, size } = await this.storage.upload({
            orderId: command.orderId,
            filename: command.filename,
            mime: command.mime,
            body: command.body
        })

        return this.repo.stageEvidenceFile({
            uploaderId: command.viewerId,
            orderId: command.orderId,
            side,
            key,
            name: command.filename,
            size,
            mime: command.mime
        })
    }
}
