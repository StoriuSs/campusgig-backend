import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    ADMIN_ACTIVITY_REPOSITORY_PORT,
    AdminActivityItem,
    AdminActivityRepositoryPort
} from '../../../domain/ports/admin-activity.repository.port'
import { ListActivityQuery } from './list-activity.query'

export interface ListActivityResult {
    items: AdminActivityItem[]
    total: number
    admins: { id: string; email: string | null }[]
}

@QueryHandler(ListActivityQuery)
export class ListActivityHandler implements IQueryHandler<ListActivityQuery> {
    constructor(@Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly repo: AdminActivityRepositoryPort) {}

    async execute(query: ListActivityQuery): Promise<ListActivityResult> {
        const [list, admins] = await Promise.all([
            this.repo.list({
                filter: query.filter,
                adminUserId: query.adminUserId,
                from: query.from,
                to: query.to,
                page: query.page,
                pageSize: query.pageSize
            }),
            this.repo.listAdmins()
        ])
        return { items: list.items, total: list.total, admins }
    }
}
