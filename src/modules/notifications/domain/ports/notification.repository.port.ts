import { EmailPreferences, NotificationData, NotificationFilter, NotificationType } from '../notification.types'

export const NOTIFICATION_REPOSITORY_PORT = Symbol('NotificationRepositoryPort')

export interface NotificationItem {
    id: string
    recipientId: string
    type: NotificationType
    data: NotificationData
    readAt: Date | null
    emailSent: boolean
    createdAt: Date
}

export interface CreateNotificationInput {
    recipientId: string
    type: NotificationType
    data: NotificationData
    emailSent?: boolean
}

export interface NotificationListResult {
    items: NotificationItem[]
    total: number
}

export interface NotificationRepositoryPort {
    create(input: CreateNotificationInput): Promise<NotificationItem>
    createMany(inputs: CreateNotificationInput[]): Promise<void>
    list(
        recipientId: string,
        filter: NotificationFilter,
        page: number,
        pageSize: number
    ): Promise<NotificationListResult>
    recent(recipientId: string, limit: number): Promise<NotificationItem[]>
    unreadCount(recipientId: string): Promise<number>
    // Marks one row read; no-op if it isn't the recipient's row (ownership guard).
    markRead(id: string, recipientId: string): Promise<void>
    markAllRead(recipientId: string): Promise<void>
    markEmailSent(id: string): Promise<void>
    findAdminIds(): Promise<string[]>
    findRecipientEmail(userId: string): Promise<string | null>
    // Email + the recipient's email preferences (F17), in one read for the email worker.
    findEmailRecipient(userId: string): Promise<{ email: string | null; prefs: EmailPreferences } | null>
    findDisplayName(userId: string): Promise<string | null>
}
