import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT } from '@/modules/orders/domain/ports'

import { DISPUTES_REPOSITORY_PORT } from '../../../domain/ports/disputes.repository.port'
import { DisputeResolvedEvent } from '../../../domain/events'
import { ResolveDisputeHandler } from './resolve-dispute.handler'
import { ResolveDisputeCommand } from './resolve-dispute.command'

describe('ResolveDisputeHandler', () => {
    const dispute = { id: 'd1', orderId: 'o1', filedByUserId: 'u-buyer' }
    const refs = { refundId: 'r1' }

    let handler: ResolveDisputeHandler
    let repo: { resolve: jest.Mock }
    let ordersRepo: { findByIdForViewer: jest.Mock }
    let eventBus: { publish: jest.Mock }

    beforeEach(async () => {
        repo = { resolve: jest.fn().mockResolvedValue({ orderId: 'o1', dispute, refs }) }
        ordersRepo = { findByIdForViewer: jest.fn().mockResolvedValue({ id: 'o1' }) }
        eventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResolveDisputeHandler,
                { provide: DISPUTES_REPOSITORY_PORT, useValue: repo },
                { provide: ORDERS_REPOSITORY_PORT, useValue: ordersRepo },
                { provide: EventBus, useValue: eventBus }
            ]
        }).compile()

        handler = module.get(ResolveDisputeHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('resolves with the verdict and publishes DisputeResolvedEvent', async () => {
        await handler.execute(new ResolveDisputeCommand('o1', 'admin1', 'SplitFunds', 60, 'internal note'))

        expect(repo.resolve).toHaveBeenCalledWith('o1', 'admin1', {
            verdict: 'SplitFunds',
            buyerRefundPercent: 60,
            adminNotes: 'internal note'
        })
        // Admin isn't a participant — OrderDetail is read as the filer.
        expect(ordersRepo.findByIdForViewer).toHaveBeenCalledWith('o1', 'u-buyer')
        expect(eventBus.publish).toHaveBeenCalledTimes(1)
        expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(DisputeResolvedEvent)
    })
})
