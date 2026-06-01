import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    AdminUserDetail,
    USER_REPOSITORY_PORT,
    UserNotFoundException,
    UserRepositoryPort
} from '@/modules/users/domain'
import { GetAdminUserDetailQuery } from './get-admin-user-detail.query'

@QueryHandler(GetAdminUserDetailQuery)
export class GetAdminUserDetailHandler implements IQueryHandler<GetAdminUserDetailQuery> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly repo: UserRepositoryPort) {}

    async execute(query: GetAdminUserDetailQuery): Promise<AdminUserDetail> {
        const detail = await this.repo.getAdminDetail(query.userId)
        if (!detail) {
            throw new UserNotFoundException(query.userId)
        }
        return detail
    }
}
