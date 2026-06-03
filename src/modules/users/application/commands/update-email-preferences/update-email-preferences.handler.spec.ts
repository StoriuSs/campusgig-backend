import { UpdateEmailPreferencesHandler } from './update-email-preferences.handler'
import { UpdateEmailPreferencesCommand } from './update-email-preferences.command'

describe('UpdateEmailPreferencesHandler', () => {
    function make() {
        const userRepo = { update: jest.fn().mockImplementation((_id, data) => Promise.resolve(data)) }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = new UpdateEmailPreferencesHandler(userRepo as any)
        return { handler, userRepo }
    }

    it('passes only the provided flags to the repo (partial update)', async () => {
        const { handler, userRepo } = make()
        await handler.execute(new UpdateEmailPreferencesCommand('u1', { emailOrders: false }))
        expect(userRepo.update).toHaveBeenCalledWith('u1', { emailOrders: false })
    })

    it('forwards the master switch + multiple categories', async () => {
        const { handler, userRepo } = make()
        await handler.execute(
            new UpdateEmailPreferencesCommand('u1', {
                emailNotificationsEnabled: false,
                emailDisputes: true,
                emailGigs: false
            })
        )
        expect(userRepo.update).toHaveBeenCalledWith('u1', {
            emailNotificationsEnabled: false,
            emailDisputes: true,
            emailGigs: false
        })
    })
})
