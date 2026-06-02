import { NotificationData, NotificationType } from '../../domain/notification.types'

// Internal command — the single write path. `recipientIds` supports admin fan-out
// (one row per admin). Event handlers build this; nothing user-facing dispatches it.
export class CreateNotificationCommand {
    constructor(
        public readonly recipientIds: string[],
        public readonly type: NotificationType,
        public readonly data: NotificationData
    ) {}
}
