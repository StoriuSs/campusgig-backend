import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT } from '@/modules/orders/domain/ports'

import { DISPUTES_REPOSITORY_PORT } from '../../../domain/ports/disputes.repository.port'
import { DisputeFiledEvent } from '../../../domain/events'
import { DisputeJobsScheduler } from '../../../infrastructure/jobs/dispute-jobs.scheduler'
import { FileDisputeHandler } from './file-dispute.handler'
import { FileDisputeCommand } from './file-dispute.command'

describe('FileDisputeHandler', () => {
    const deadline = new Date('2026-06-03T10:00:00.000Z')
    const dispute = { id: 'd1', orderId: 'o1', responseDeadline: deadline, filedByUserId: 'u-buyer' }

    let handler: FileDisputeHandler
    let repo: { fileDispute: jest.Mock }
    let ordersRepo: { findByIdForViewer: jest.Mock }
    let jobs: { scheduleResponseTimeout: jest.Mock }
    let eventBus: { publish: jest.Mock }

    beforeEach(async () => {
        repo = { fileDispute: jest.fn().mockResolvedValue({ orderId: 'o1', dispute }) }
        ordersRepo = { findByIdForViewer: jest.fn().mockResolvedValue({ id: 'o1' }) }
        jobs = { scheduleResponseTimeout: jest.fn().mockResolvedValue(undefined) }
        eventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FileDisputeHandler,
                { provide: DISPUTES_REPOSITORY_PORT, useValue: repo },
                { provide: ORDERS_REPOSITORY_PORT, useValue: ordersRepo },
                { provide: DisputeJobsScheduler, useValue: jobs },
                { provide: EventBus, useValue: eventBus }
            ]
        }).compile()

        handler = module.get(FileDisputeHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('files the dispute, schedules the 48h timeout, and publishes DisputeFiledEvent', async () => {
        await handler.execute(new FileDisputeCommand('o1', 'u-buyer', 'WorkNotAsDescribed', 'x'.repeat(40), ['e1']))

        expect(repo.fileDispute).toHaveBeenCalledWith({
            orderId: 'o1',
            viewerId: 'u-buyer',
            reasonCode: 'WorkNotAsDescribed',
            statement: 'x'.repeat(40),
            evidenceFileIds: ['e1']
        })
        expect(jobs.scheduleResponseTimeout).toHaveBeenCalledWith('d1', deadline)
        expect(eventBus.publish).toHaveBeenCalledTimes(1)
        expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(DisputeFiledEvent)
    })

    it('still schedules the timeout but skips publish when OrderDetail is unavailable', async () => {
        ordersRepo.findByIdForViewer.mockResolvedValue(null)
        await handler.execute(new FileDisputeCommand('o1', 'u-buyer', 'WorkNotAsDescribed', 'x'.repeat(40), []))
        expect(jobs.scheduleResponseTimeout).toHaveBeenCalled()
        expect(eventBus.publish).not.toHaveBeenCalled()
    })
})
