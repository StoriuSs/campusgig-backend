import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'

import {
    AdminActivityItem,
    AdminActivityListFilters,
    AdminActivityListResult,
    AdminActivityRepositoryPort,
    LogAdminActionInput
} from '../../domain/ports/admin-activity.repository.port'
import { ACTION_TYPES_BY_FILTER, AdminActionType, AdminActivityTargetType } from '../../domain/admin-activity.types'

@Injectable()
export class PrismaAdminActivityRepository implements AdminActivityRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async log(input: LogAdminActionInput): Promise<void> {
        const client = input.tx ?? this.prisma
        await client.adminActivityLog.create({
            data: {
                adminUserId: input.adminUserId,
                actionType: input.actionType,
                targetType: input.targetType,
                targetId: input.targetId ?? null,
                summary: input.summary,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                metadata: (input.metadata ?? undefined) as any
            }
        })
    }

    async list(filters: AdminActivityListFilters): Promise<AdminActivityListResult> {
        const where = this.buildWhere(filters)
        const skip = (filters.page - 1) * filters.pageSize

        const [rows, total] = await Promise.all([
            this.prisma.adminActivityLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: filters.pageSize,
                include: { admin: { select: { email: true } } }
            }),
            this.prisma.adminActivityLog.count({ where })
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { items: rows.map((r: any) => this.toItem(r)), total }
    }

    async recent(limit: number): Promise<AdminActivityItem[]> {
        const rows = await this.prisma.adminActivityLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { admin: { select: { email: true } } }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return rows.map((r: any) => this.toItem(r))
    }

    async listAdmins(): Promise<{ id: string; email: string | null }[]> {
        return this.prisma.user.findMany({
            where: { isAdmin: true },
            select: { id: true, email: true },
            orderBy: { email: 'asc' }
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private buildWhere(filters: AdminActivityListFilters): any {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {}
        if (filters.filter !== 'all') {
            where.actionType = { in: ACTION_TYPES_BY_FILTER[filters.filter] }
        }
        if (filters.adminUserId) where.adminUserId = filters.adminUserId
        if (filters.from || filters.to) {
            where.createdAt = {}
            if (filters.from) where.createdAt.gte = filters.from
            if (filters.to) where.createdAt.lte = filters.to
        }
        return where
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toItem(r: any): AdminActivityItem {
        return {
            id: r.id,
            adminUserId: r.adminUserId,
            adminEmail: r.admin?.email ?? null,
            actionType: r.actionType as AdminActionType,
            targetType: r.targetType as AdminActivityTargetType,
            targetId: r.targetId ?? null,
            metadata: (r.metadata ?? null) as Record<string, unknown> | null,
            summary: r.summary,
            createdAt: r.createdAt
        }
    }
}
