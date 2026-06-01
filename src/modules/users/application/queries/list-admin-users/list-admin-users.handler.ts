import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { AdminUserListResult, USER_REPOSITORY_PORT, UserRepositoryPort } from '@/modules/users/domain'
import { ListAdminUsersQuery } from './list-admin-users.query'

@QueryHandler(ListAdminUsersQuery)
export class ListAdminUsersHandler implements IQueryHandler<ListAdminUsersQuery> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly repo: UserRepositoryPort) {}

    execute(query: ListAdminUsersQuery): Promise<AdminUserListResult> {
        return this.repo.listForAdmin(query.filters)
    }
}
