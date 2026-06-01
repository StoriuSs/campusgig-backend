import { AdminActivityFilter } from '../../../domain/admin-activity.types'

export class ListActivityQuery {
    constructor(
        public readonly filter: AdminActivityFilter,
        public readonly adminUserId: string | undefined,
        public readonly from: Date | undefined,
        public readonly to: Date | undefined,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
