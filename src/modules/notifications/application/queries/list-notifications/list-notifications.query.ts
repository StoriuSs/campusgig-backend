import { NotificationFilter } from '../../../domain/notification.types'

export class ListNotificationsQuery {
    constructor(
        public readonly recipientId: string,
        public readonly filter: NotificationFilter,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
