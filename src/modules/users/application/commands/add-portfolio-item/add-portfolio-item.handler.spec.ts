import { Test, TestingModule } from '@nestjs/testing'
import { AddPortfolioItemHandler } from './add-portfolio-item.handler'
import { AddPortfolioItemCommand } from './add-portfolio-item.command'
import { USER_REPOSITORY_PORT, MaxPortfolioItemsReachedException, PortfolioItemEntity } from '@/modules/users/domain'
import { STORAGE_PORT } from '../../ports'

describe('AddPortfolioItemHandler', () => {
    let handler: AddPortfolioItemHandler
    let mockUserRepo: { countPortfolioItems: jest.Mock; addPortfolioItem: jest.Mock }
    let mockStorage: { uploadPortfolioItem: jest.Mock }

    beforeEach(async () => {
        mockUserRepo = {
            countPortfolioItems: jest.fn(),
            addPortfolioItem: jest.fn()
        }
        mockStorage = {
            uploadPortfolioItem: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AddPortfolioItemHandler,
                { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo },
                { provide: STORAGE_PORT, useValue: mockStorage }
            ]
        }).compile()

        handler = module.get<AddPortfolioItemHandler>(AddPortfolioItemHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should upload, persist, and return the new item', async () => {
        mockUserRepo.countPortfolioItems.mockResolvedValue(2)
        mockStorage.uploadPortfolioItem.mockResolvedValue({
            key: 'portfolio/portfolio-user1-xyz.webp',
            path: 's3://...',
            width: 1600,
            height: 1200
        })
        const created = new PortfolioItemEntity({
            id: 'item-1',
            userId: 'user-1',
            imageKey: 'portfolio/portfolio-user1-xyz.webp',
            width: 1600,
            height: 1200,
            position: 2
        })
        mockUserRepo.addPortfolioItem.mockResolvedValue(created)

        const buffer = Buffer.from('fake-image-data')
        const result = await handler.execute(new AddPortfolioItemCommand('user-1', buffer, 'photo.jpg'))

        expect(mockStorage.uploadPortfolioItem).toHaveBeenCalledWith(buffer, 'photo.jpg', 'user-1')
        expect(mockUserRepo.addPortfolioItem).toHaveBeenCalledWith({
            userId: 'user-1',
            imageKey: 'portfolio/portfolio-user1-xyz.webp',
            width: 1600,
            height: 1200
        })
        expect(result).toBe(created)
    })

    it('should throw MaxPortfolioItemsReachedException at the cap, without uploading', async () => {
        mockUserRepo.countPortfolioItems.mockResolvedValue(9)

        await expect(
            handler.execute(new AddPortfolioItemCommand('user-1', Buffer.from('x'), 'photo.jpg'))
        ).rejects.toThrow(MaxPortfolioItemsReachedException)

        expect(mockStorage.uploadPortfolioItem).not.toHaveBeenCalled()
        expect(mockUserRepo.addPortfolioItem).not.toHaveBeenCalled()
    })
})
