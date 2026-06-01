import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessageItem, MessagingRepositoryPort } from '@/modules/messaging/domain/ports'

import {
    AdminDisputeDetail,
    DISPUTES_REPOSITORY_PORT,
    DisputesRepositoryPort
} from '../../../domain/ports/disputes.repository.port'
import { DisputeNotFoundException } from '../../../domain/exceptions'
import { GetAdminDisputeQuery } from './get-admin-dispute.query'

export interface AdminDisputeDetailResult {
    detail: AdminDisputeDetail
    chat: MessageItem[]
}

const CHAT_PAGE = 50

@QueryHandler(GetAdminDisputeQuery)
export class GetAdminDisputeHandler implements IQueryHandler<GetAdminDisputeQuery> {
    constructor(
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort,
        @Inject(MESSAGING_REPOSITORY_PORT) private readonly messagingRepo: MessagingRepositoryPort
    ) {}

    async execute(query: GetAdminDisputeQuery): Promise<AdminDisputeDetailResult> {
        const detail = await this.repo.getForAdmin(query.orderId)
        if (!detail) throw new DisputeNotFoundException(query.orderId)

        const buyerId = detail.filer.role === 'Buyer' ? detail.filer.userId : detail.counterparty.userId
        const sellerId = detail.filer.role === 'Seller' ? detail.filer.userId : detail.counterparty.userId

        // Read the order thread (incl. system events) as a participant — admin isn't one.
        // Deliveries come from getForAdmin (with file keys for inline presigning).
        const thread = await this.messagingRepo.createOrGetThread(buyerId, sellerId)
        const chat = await this.messagingRepo.listMessages(thread.id, null, CHAT_PAGE, { orderId: query.orderId })

        return { detail, chat }
    }
}
