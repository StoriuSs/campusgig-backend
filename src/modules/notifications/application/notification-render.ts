import { NotificationData, NotificationType } from '../domain/notification.types'

// Relative frontend path a notification deep-links to (mirrors the FE meta map).
export function notificationPath(type: NotificationType, data: NotificationData): string {
    const orderId = String(data.orderId ?? '')
    const gigId = String(data.gigId ?? '')
    switch (type) {
        case 'gig_approved':
        case 'gig_rejected':
            return `/gigs/${gigId}/manage`
        case 'endorsed':
        case 'endorsement_revoked':
            return '/profile'
        case 'admin_gig_pending':
            return '/admin/queue'
        case 'admin_dispute_filed':
            return `/admin/disputes/${orderId}`
        case 'admin_withdrawal_requested':
            return '/admin/withdrawals'
        case 'funds_released':
            return orderId ? `/orders/${orderId}` : '/wallet'
        default:
            return `/orders/${orderId}`
    }
}

interface RenderedEmail {
    subject: string
    heading: string
    body: string
    ctaLabel: string
}

const vnd = (v: unknown) => `${Number(v ?? 0).toLocaleString('vi-VN')}₫`

// English email copy for the email-flagged types (worker renders server-side).
export function renderNotificationEmail(type: NotificationType, data: NotificationData): RenderedEmail {
    const actor = String(data.actorName ?? 'Someone')
    const code = String(data.orderCode ?? '')
    const gig = String(data.gigTitle ?? '')
    switch (type) {
        case 'order_placed':
            return {
                subject: `New order on "${gig}"`,
                heading: 'New order received',
                body: `${actor} placed an order on "${gig}" (${code}).`,
                ctaLabel: 'View order'
            }
        case 'order_delivered':
            return {
                subject: `Files delivered for ${code}`,
                heading: 'Delivery received',
                body: `${actor} delivered files for order ${code}.`,
                ctaLabel: 'View order'
            }
        case 'order_auto_completed':
            return {
                subject: `Order ${code} auto-completed`,
                heading: 'Order auto-completed',
                body: `Order ${code} auto-completed. The 7-day dispute window has started.`,
                ctaLabel: 'View order'
            }
        case 'extension_requested':
            return {
                subject: `Extension requested on ${code}`,
                heading: 'Extension requested',
                body: `${actor} requested an extension on order ${code}.`,
                ctaLabel: 'View order'
            }
        case 'cancellation_requested':
            return {
                subject: `Cancellation requested on ${code}`,
                heading: 'Cancellation requested',
                body: `${actor} requested to cancel order ${code}.`,
                ctaLabel: 'View order'
            }
        case 'dispute_filed':
            return {
                subject: `Dispute filed on ${code}`,
                heading: 'Dispute filed',
                body: `A dispute has been filed on order ${code}.`,
                ctaLabel: 'View order'
            }
        case 'dispute_resolved':
            return {
                subject: `Dispute resolved on ${code}`,
                heading: 'Dispute resolved',
                body: `An admin resolved the dispute on order ${code}.`,
                ctaLabel: 'View order'
            }
        case 'gig_rejected': {
            const reason = data.reason ? ` Reason: ${String(data.reason)}` : ''
            return {
                subject: `Your gig "${gig}" was rejected`,
                heading: 'Gig rejected',
                body: `Your gig "${gig}" was rejected.${reason}`,
                ctaLabel: 'View gig'
            }
        }
        default:
            return {
                subject: 'CampusGig notification',
                heading: 'You have a new notification',
                body: code ? `Update on order ${code}.` : 'Open CampusGig to see the details.',
                ctaLabel: 'Open CampusGig'
            }
    }
}

export { vnd as formatVnd }
