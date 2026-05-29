import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort, ConversationListItem } from '../../../domain/ports'
import { GetInboxConversationsQuery } from './get-inbox-conversations.query'

@QueryHandler(GetInboxConversationsQuery)
export class GetInboxConversationsHandler implements IQueryHandler<GetInboxConversationsQuery> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    execute(query: GetInboxConversationsQuery): Promise<{ items: ConversationListItem[]; total: number }> {
        return this.repo.listConversations(query.viewerId, query.page, query.pageSize)
    }
}
