import { EmailPreferences, emailAllowed } from './notification.types'

const all = (over: Partial<EmailPreferences> = {}): EmailPreferences => ({
    emailNotificationsEnabled: true,
    emailOrders: true,
    emailDisputes: true,
    emailGigs: true,
    ...over
})

describe('emailAllowed', () => {
    it('master off blocks every email type', () => {
        const prefs = all({ emailNotificationsEnabled: false })
        expect(emailAllowed('order_placed', prefs)).toBe(false)
        expect(emailAllowed('dispute_filed', prefs)).toBe(false)
        expect(emailAllowed('gig_rejected', prefs)).toBe(false)
    })

    it('category off blocks only that category', () => {
        expect(emailAllowed('order_delivered', all({ emailOrders: false }))).toBe(false)
        expect(emailAllowed('dispute_filed', all({ emailOrders: false }))).toBe(true)
        expect(emailAllowed('dispute_resolved', all({ emailDisputes: false }))).toBe(false)
        expect(emailAllowed('gig_rejected', all({ emailGigs: false }))).toBe(false)
        expect(emailAllowed('order_placed', all({ emailGigs: false }))).toBe(true)
    })

    it('all-on (default) allows every email type', () => {
        for (const t of [
            'order_placed',
            'order_delivered',
            'order_auto_completed',
            'extension_requested',
            'cancellation_requested',
            'dispute_filed',
            'dispute_resolved',
            'gig_rejected'
        ] as const) {
            expect(emailAllowed(t, all())).toBe(true)
        }
    })
})
