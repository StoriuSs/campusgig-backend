import { Test, TestingModule } from '@nestjs/testing'
import { CommandBus } from '@nestjs/cqrs'

import { ExtensionRequestedEvent, OrderAcceptedDeliveryEvent, OrderPlacedEvent } from '@/modules/orders/domain/events'
import type { OrderDetail } from '@/modules/orders/domain/ports'

import { OrderNotificationsHandler } from './order-notifications.handler'
import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

function makeOrder(): OrderDetail {
    return {
        id: 'o1',
        number: 1042,
        buyer: { id: 'buyer-1', username: 'buyer', displayName: 'Lan Phuong', avatarKey: null, endorsedAt: null },
        seller: { id: 'seller-1', username: 'seller', displayName: 'Minh Duc', avatarKey: null, endorsedAt: null },
        gig: { id: 'g1', titleSnapshot: 'Logo Design', priceVndSnapshot: 150_000, deliveryDays: 3, coverKey: null }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
}

describe('OrderNotificationsHandler', () => {
    let handler: OrderNotificationsHandler
    let bus: { execute: jest.Mock }

    beforeEach(async () => {
        bus = { execute: jest.fn() }
        const module: TestingModule = await Test.createTestingModule({
            providers: [OrderNotificationsHandler, { provide: CommandBus, useValue: bus }]
        }).compile()
        handler = module.get(OrderNotificationsHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('notifies the seller when a buyer places an order', async () => {
        await handler.handle(new OrderPlacedEvent(makeOrder(), {} as never, 'buyer-1'))

        const cmd = bus.execute.mock.calls[0][0] as CreateNotificationCommand
        expect(cmd.recipientIds).toEqual(['seller-1'])
        expect(cmd.type).toBe('order_placed')
        expect(cmd.data).toMatchObject({ orderCode: 'CG-1042', gigTitle: 'Logo Design', actorName: 'Lan Phuong' })
    })

    it('routes to the non-actor party (extension requested by seller → buyer)', async () => {
        await handler.handle(new ExtensionRequestedEvent(makeOrder(), {} as never, 'seller-1'))

        const cmd = bus.execute.mock.calls[0][0] as CreateNotificationCommand
        expect(cmd.recipientIds).toEqual(['buyer-1'])
        expect(cmd.type).toBe('extension_requested')
        expect(cmd.data.actorName).toBe('Minh Duc')
    })

    it('emits both order_completed and funds_released to the seller on delivery acceptance', async () => {
        await handler.handle(new OrderAcceptedDeliveryEvent(makeOrder(), {} as never, 'buyer-1'))

        const types = bus.execute.mock.calls.map((c) => (c[0] as CreateNotificationCommand).type)
        expect(types).toEqual(['order_completed', 'funds_released'])
        const funds = bus.execute.mock.calls[1][0] as CreateNotificationCommand
        expect(funds.recipientIds).toEqual(['seller-1'])
        expect(funds.data.amountVnd).toBe(120_000) // 150k − floor(20%)
    })
})
