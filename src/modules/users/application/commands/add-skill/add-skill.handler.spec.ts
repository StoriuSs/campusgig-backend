import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { AddSkillHandler } from './add-skill.handler'
import { AddSkillCommand } from './add-skill.command'
import { USER_REPOSITORY_PORT, MaxSkillsReachedException, UserSkillEntity } from '@/modules/users/domain'

describe('AddSkillHandler', () => {
    let handler: AddSkillHandler
    let mockUserRepo: { countSkills: jest.Mock; addSkill: jest.Mock }

    beforeEach(async () => {
        mockUserRepo = {
            countSkills: jest.fn(),
            addSkill: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [AddSkillHandler, { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo }]
        }).compile()

        handler = module.get<AddSkillHandler>(AddSkillHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should add a skill when under the cap', async () => {
        mockUserRepo.countSkills.mockResolvedValue(3)
        const created = new UserSkillEntity({
            id: 'skill-1',
            userId: 'user-1',
            name: 'Python',
            position: 3
        })
        mockUserRepo.addSkill.mockResolvedValue(created)

        const result = await handler.execute(new AddSkillCommand('user-1', '  Python  '))

        expect(mockUserRepo.addSkill).toHaveBeenCalledWith('user-1', 'Python')
        expect(result).toBe(created)
    })

    it('should throw MaxSkillsReachedException when user already has 10 skills', async () => {
        mockUserRepo.countSkills.mockResolvedValue(10)

        await expect(handler.execute(new AddSkillCommand('user-1', 'Python'))).rejects.toThrow(
            MaxSkillsReachedException
        )
        expect(mockUserRepo.addSkill).not.toHaveBeenCalled()
    })

    it('should throw BadRequestException for empty / whitespace-only / too-long names', async () => {
        mockUserRepo.countSkills.mockResolvedValue(0)

        await expect(handler.execute(new AddSkillCommand('user-1', ''))).rejects.toThrow(BadRequestException)
        await expect(handler.execute(new AddSkillCommand('user-1', '   '))).rejects.toThrow(BadRequestException)
        await expect(handler.execute(new AddSkillCommand('user-1', 'x'.repeat(31)))).rejects.toThrow(
            BadRequestException
        )

        expect(mockUserRepo.addSkill).not.toHaveBeenCalled()
    })
})
