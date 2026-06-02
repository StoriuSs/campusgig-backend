// The notification kinds F15 emits. Admin kinds (admin_*) fan out to every admin.
export type NotificationType =
    | 'order_placed'
    | 'order_accepted'
    | 'order_declined'
    | 'order_delivered'
    | 'order_completed'
    | 'order_auto_completed'
    | 'order_marked_late'
    | 'funds_released'
    | 'extension_requested'
    | 'extension_decided'
    | 'cancellation_requested'
    | 'cancellation_decided'
    | 'dispute_filed'
    | 'dispute_resolved'
    | 'review_left'
    | 'gig_approved'
    | 'gig_rejected'
    | 'endorsed'
    | 'endorsement_revoked'
    | 'admin_gig_pending'
    | 'admin_dispute_filed'
    | 'admin_withdrawal_requested'

// Display primitives stored on the row; the client + email worker render text
// from these. Keys are camelCase (round-trip snake↔camel via the interceptors).
export type NotificationData = Record<string, string | number | boolean | null>

export type NotificationFilter = 'all' | 'unread'

// Time-sensitive kinds that also send an email (SRS § III email rule).
export const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
    'order_placed',
    'order_delivered',
    'order_auto_completed',
    'extension_requested',
    'cancellation_requested',
    'dispute_filed',
    'dispute_resolved',
    'gig_rejected'
])

export function isEmailType(type: NotificationType): boolean {
    return EMAIL_TYPES.has(type)
}
