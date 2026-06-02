import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationListResult,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { ListNotificationsQuery } from './list-notifications.query'

@QueryHandler(ListNotificationsQuery)
export class ListNotificationsHandler implements IQueryHandler<ListNotificationsQuery> {
    constructor(@Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort) {}

    execute(query: ListNotificationsQuery): Promise<NotificationListResult> {
        return this.repo.list(query.recipientId, query.filter, query.page, query.pageSize)
    }
}
