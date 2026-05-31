import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { GetPublicProfileByUsernameQuery } from './get-public-profile-by-username.query'
import {
    UserRepositoryPort,
    USER_REPOSITORY_PORT,
    UserWithRelations,
    UserNotFoundException
} from '@/modules/users/domain'

@QueryHandler(GetPublicProfileByUsernameQuery)
export class GetPublicProfileByUsernameHandler implements IQueryHandler<
    GetPublicProfileByUsernameQuery,
    UserWithRelations
> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort) {}

    async execute(query: GetPublicProfileByUsernameQuery): Promise<UserWithRelations> {
        const result = await this.userRepo.findByUsernameWithRelations(query.username.toLowerCase())

        if (!result) {
            throw new UserNotFoundException(query.username)
        }

        return result
    }
}
