import { NotificationEmailConsumer } from './notification-email.consumer'

describe('NotificationEmailConsumer (pref gating)', () => {
    const prefs = (over = {}) => ({
        emailNotificationsEnabled: true,
        emailOrders: true,
        emailDisputes: true,
        emailGigs: true,
        ...over
    })

    function make(recipient: { email: string | null; prefs: ReturnType<typeof prefs> } | null) {
        const repo = {
            findEmailRecipient: jest.fn().mockResolvedValue(recipient),
            markEmailSent: jest.fn().mockResolvedValue(undefined)
        }
        const emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) }
        const config = { get: jest.fn().mockReturnValue('') }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const consumer = new NotificationEmailConsumer(repo as any, emailService as any, config as any)
        return { consumer, repo, emailService }
    }

    const job = (type: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ id: 'j1', data: { notificationId: 'n1', recipientId: 'u1', type, data: { orderCode: 'CG-0001' } } }) as any

    it('sends + marks when the category is allowed', async () => {
        const { consumer, repo, emailService } = make({ email: 'u@x.com', prefs: prefs() })
        await consumer.process(job('order_placed'))
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
        expect(repo.markEmailSent).toHaveBeenCalledWith('n1')
    })

    it('skips when the master switch is off', async () => {
        const { consumer, emailService, repo } = make({
            email: 'u@x.com',
            prefs: prefs({ emailNotificationsEnabled: false })
        })
        await consumer.process(job('order_placed'))
        expect(emailService.sendEmail).not.toHaveBeenCalled()
        expect(repo.markEmailSent).not.toHaveBeenCalled()
    })

    it('skips when that category is off but allows others', async () => {
        const off = make({ email: 'u@x.com', prefs: prefs({ emailDisputes: false }) })
        await off.consumer.process(job('dispute_filed'))
        expect(off.emailService.sendEmail).not.toHaveBeenCalled()

        const on = make({ email: 'u@x.com', prefs: prefs({ emailDisputes: false }) })
        await on.consumer.process(job('order_delivered'))
        expect(on.emailService.sendEmail).toHaveBeenCalledTimes(1)
    })

    it('skips when the recipient has no email', async () => {
        const { consumer, emailService } = make({ email: null, prefs: prefs() })
        await consumer.process(job('order_placed'))
        expect(emailService.sendEmail).not.toHaveBeenCalled()
    })
})
