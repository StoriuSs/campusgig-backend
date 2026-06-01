import { AdminUserListFilters } from '@/modules/users/domain'

export class ListAdminUsersQuery {
    constructor(public readonly filters: AdminUserListFilters) {}
}
