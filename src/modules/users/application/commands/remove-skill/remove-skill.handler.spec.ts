import { Test, TestingModule } from '@nestjs/testing'
import { RemoveSkillHandler } from './remove-skill.handler'
import { RemoveSkillCommand } from './remove-skill.command'
import { USER_REPOSITORY_PORT, SkillNotFoundException } from '@/modules/users/domain'

describe('RemoveSkillHandler', () => {
    let handler: RemoveSkillHandler
    let mockUserRepo: { removeSkill: jest.Mock }

    beforeEach(async () => {
        mockUserRepo = { removeSkill: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [RemoveSkillHandler, { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo }]
        }).compile()

        handler = module.get<RemoveSkillHandler>(RemoveSkillHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should call the repo with userId + skillId', async () => {
        mockUserRepo.removeSkill.mockResolvedValue(undefined)

        await handler.execute(new RemoveSkillCommand('user-1', 'skill-1'))

        expect(mockUserRepo.removeSkill).toHaveBeenCalledWith('user-1', 'skill-1')
    })

    it('should propagate SkillNotFoundException from the repo', async () => {
        mockUserRepo.removeSkill.mockRejectedValue(new SkillNotFoundException('skill-1'))

        await expect(handler.execute(new RemoveSkillCommand('user-1', 'skill-1'))).rejects.toThrow(
            SkillNotFoundException
        )
    })
})
