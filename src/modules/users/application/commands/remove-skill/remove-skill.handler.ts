import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { RemoveSkillCommand } from './remove-skill.command'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'

/**
 * Thin pass-through handler. The repository performs the ownership check
 * (delete WHERE id = ? AND userId = ?) and throws SkillNotFoundException
 * if zero rows affected — so we don't need a separate find-then-delete here.
 */
@CommandHandler(RemoveSkillCommand)
export class RemoveSkillHandler implements ICommandHandler<RemoveSkillCommand> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort) {}

    async execute(command: RemoveSkillCommand): Promise<void> {
        await this.userRepo.removeSkill(command.userId, command.skillId)
    }
}
