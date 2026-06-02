import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationItem,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { GetRecentNotificationsQuery } from './get-recent-notifications.query'

export interface RecentNotificationsResult {
    items: NotificationItem[]
    unreadCount: number
}

@QueryHandler(GetRecentNotificationsQuery)
export class GetRecentNotificationsHandler implements IQueryHandler<GetRecentNotificationsQuery> {
    constructor(@Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort) {}

    async execute(query: GetRecentNotificationsQuery): Promise<RecentNotificationsResult> {
        const [items, unreadCount] = await Promise.all([
            this.repo.recent(query.recipientId, query.limit),
            this.repo.unreadCount(query.recipientId)
        ])
        return { items, unreadCount }
    }
}
