import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { AddSkillCommand } from './add-skill.command'
import {
    UserRepositoryPort,
    USER_REPOSITORY_PORT,
    UserSkillEntity,
    MaxSkillsReachedException
} from '@/modules/users/domain'

const MAX_SKILLS_PER_USER = 10
const MAX_SKILL_NAME_LENGTH = 30

@CommandHandler(AddSkillCommand)
export class AddSkillHandler implements ICommandHandler<AddSkillCommand> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort) {}

    async execute(command: AddSkillCommand): Promise<UserSkillEntity> {
        const trimmed = command.name.trim()

        // Input validation (boundary check, not a domain invariant)
        if (trimmed.length === 0) {
            throw new BadRequestException('Skill name cannot be empty.')
        }
        if (trimmed.length > MAX_SKILL_NAME_LENGTH) {
            throw new BadRequestException(`Skill name must be ${MAX_SKILL_NAME_LENGTH} characters or fewer.`)
        }

        // Enforce the 10-skill cap. count + add is racy under concurrent
        // requests from the same user (could go to 11 in a tiny window),
        // but that's a non-issue at campus scale — and the limit is soft
        // anyway (no data corruption if it briefly bumps).
        const count = await this.userRepo.countSkills(command.userId)
        if (count >= MAX_SKILLS_PER_USER) {
            throw new MaxSkillsReachedException()
        }

        return this.userRepo.addSkill(command.userId, trimmed)
    }
}
