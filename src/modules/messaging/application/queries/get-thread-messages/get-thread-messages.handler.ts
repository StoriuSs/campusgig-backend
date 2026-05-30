import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort, MessageItem } from '../../../domain/ports'
import { NotAThreadParticipantException } from '../../../domain/exceptions'
import { GetThreadMessagesQuery } from './get-thread-messages.query'

@QueryHandler(GetThreadMessagesQuery)
export class GetThreadMessagesHandler implements IQueryHandler<GetThreadMessagesQuery> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    async execute(query: GetThreadMessagesQuery): Promise<MessageItem[]> {
        const thread = await this.repo.getThreadById(query.threadId, query.viewerId)
        if (!thread) {
            throw new NotAThreadParticipantException(query.threadId, query.viewerId)
        }
        return this.repo.listMessages(
            query.threadId,
            query.beforeId,
            query.pageSize,
            query.orderId ? { orderId: query.orderId } : undefined
        )
    }
}
