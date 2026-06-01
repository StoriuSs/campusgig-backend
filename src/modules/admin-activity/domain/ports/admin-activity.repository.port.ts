import { AdminActionType, AdminActivityFilter, AdminActivityTargetType } from '../admin-activity.types'

export const ADMIN_ACTIVITY_REPOSITORY_PORT = 'ADMIN_ACTIVITY_REPOSITORY_PORT'

export interface LogAdminActionInput {
    adminUserId: string
    actionType: AdminActionType
    targetType: AdminActivityTargetType
    targetId?: string | null
    summary: string
    metadata?: Record<string, unknown> | null
    // Prisma transaction client — pass the action's own tx so the log row is
    // written atomically with the action (no phantom on rollback).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any
}

export interface AdminActivityItem {
    id: string
    adminUserId: string
    adminEmail: string | null
    actionType: AdminActionType
    targetType: AdminActivityTargetType
    targetId: string | null
    summary: string
    metadata: Record<string, unknown> | null
    createdAt: Date
}

export interface AdminActivityListFilters {
    filter: AdminActivityFilter
    adminUserId?: string
    from?: Date
    to?: Date
    page: number
    pageSize: number
}

export interface AdminActivityListResult {
    items: AdminActivityItem[]
    total: number
}

export interface AdminActivityRepositoryPort {
    // Write one audit entry. Pass `tx` to enlist in the caller's transaction.
    log(input: LogAdminActionInput): Promise<void>
    list(filters: AdminActivityListFilters): Promise<AdminActivityListResult>
    recent(limit: number): Promise<AdminActivityItem[]>
    listAdmins(): Promise<{ id: string; email: string | null }[]>
}
