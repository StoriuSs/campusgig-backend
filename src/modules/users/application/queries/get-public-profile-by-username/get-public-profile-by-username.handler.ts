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
        // Lowercase the lookup (Risk 5 from the plan: username case-sensitivity).
        // The repo also lowercases defensively, but doing it here means the
        // contract is explicit at the query boundary.
        const result = await this.userRepo.findByUsernameWithRelations(query.username.toLowerCase())

        if (!result) {
            throw new UserNotFoundException(query.username)
        }

        // Handler doesn't filter private fields — that's the presentation
        // layer's job via PublicProfileResponseDto.
        return result
    }
}
