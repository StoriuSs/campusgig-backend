import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { GetUnreadCountQuery } from './get-unread-count.query'

@QueryHandler(GetUnreadCountQuery)
export class GetUnreadCountHandler implements IQueryHandler<GetUnreadCountQuery> {
    constructor(@Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort) {}

    execute(query: GetUnreadCountQuery): Promise<number> {
        return this.repo.unreadCount(query.recipientId)
    }
}
