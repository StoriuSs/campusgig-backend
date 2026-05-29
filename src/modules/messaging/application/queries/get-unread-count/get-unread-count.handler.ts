import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort } from '../../../domain/ports'
import { GetUnreadCountQuery } from './get-unread-count.query'

@QueryHandler(GetUnreadCountQuery)
export class GetUnreadCountHandler implements IQueryHandler<GetUnreadCountQuery> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    async execute(query: GetUnreadCountQuery): Promise<{ count: number }> {
        const count = await this.repo.getUnreadCount(query.viewerId)
        return { count }
    }
}
