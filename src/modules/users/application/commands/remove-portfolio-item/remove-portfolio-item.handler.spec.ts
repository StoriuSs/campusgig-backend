import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'
import { RemovePortfolioItemHandler } from './remove-portfolio-item.handler'
import { RemovePortfolioItemCommand } from './remove-portfolio-item.command'
import { USER_REPOSITORY_PORT, PortfolioItemEntity, PortfolioItemNotFoundException } from '@/modules/users/domain'
import { PortfolioItemDeletedEvent } from '../../events/portfolio-item-deleted.event'

describe('RemovePortfolioItemHandler', () => {
    let handler: RemovePortfolioItemHandler
    let mockUserRepo: { removePortfolioItem: jest.Mock }
    let mockEventBus: { publish: jest.Mock }

    beforeEach(async () => {
        mockUserRepo = { removePortfolioItem: jest.fn() }
        mockEventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RemovePortfolioItemHandler,
                { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get<RemovePortfolioItemHandler>(RemovePortfolioItemHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should delete and publish PortfolioItemDeletedEvent with the imageKey', async () => {
        const deleted = new PortfolioItemEntity({
            id: 'item-1',
            userId: 'user-1',
            imageKey: 'portfolio/portfolio-user1-xyz.webp',
            width: 1600,
            height: 1200,
            position: 0
        })
        mockUserRepo.removePortfolioItem.mockResolvedValue(deleted)

        await handler.execute(new RemovePortfolioItemCommand('user-1', 'item-1'))

        expect(mockUserRepo.removePortfolioItem).toHaveBeenCalledWith('user-1', 'item-1')
        expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(PortfolioItemDeletedEvent))
        const published = mockEventBus.publish.mock.calls[0][0] as PortfolioItemDeletedEvent
        expect(published.userId).toBe('user-1')
        expect(published.imageKey).toBe('portfolio/portfolio-user1-xyz.webp')
    })

    it('should propagate PortfolioItemNotFoundException from the repo, no event', async () => {
        mockUserRepo.removePortfolioItem.mockRejectedValue(new PortfolioItemNotFoundException('item-1'))

        await expect(handler.execute(new RemovePortfolioItemCommand('user-1', 'item-1'))).rejects.toThrow(
            PortfolioItemNotFoundException
        )
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
})
