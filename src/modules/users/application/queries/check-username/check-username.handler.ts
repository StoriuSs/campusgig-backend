import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { CheckUsernameQuery } from './check-username.query'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'

@QueryHandler(CheckUsernameQuery)
export class CheckUsernameHandler implements IQueryHandler<CheckUsernameQuery> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort) {}

    async execute(query: CheckUsernameQuery): Promise<boolean> {
        const existing = await this.userRepo.findByUsername(query.username)
        return !existing
    }
}
