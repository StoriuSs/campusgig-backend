import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'

import {
    CreateNotificationInput,
    NotificationItem,
    NotificationListResult,
    NotificationRepositoryPort
} from '../../domain/ports/notification.repository.port'
import { NotificationData, NotificationFilter, NotificationType } from '../../domain/notification.types'

@Injectable()
export class PrismaNotificationRepository implements NotificationRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async create(input: CreateNotificationInput): Promise<NotificationItem> {
        const row = await this.prisma.notification.create({
            data: {
                recipientId: input.recipientId,
                type: input.type,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: input.data as any,
                emailSent: input.emailSent ?? false
            }
        })
        return this.toItem(row)
    }

    async createMany(inputs: CreateNotificationInput[]): Promise<void> {
        if (inputs.length === 0) return
        await this.prisma.notification.createMany({
            data: inputs.map((i) => ({
                recipientId: i.recipientId,
                type: i.type,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: i.data as any,
                emailSent: i.emailSent ?? false
            }))
        })
    }

    async list(
        recipientId: string,
        filter: NotificationFilter,
        page: number,
        pageSize: number
    ): Promise<NotificationListResult> {
        const where = { recipientId, ...(filter === 'unread' ? { readAt: null } : {}) }
        const [rows, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            this.prisma.notification.count({ where })
        ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { items: rows.map((r: any) => this.toItem(r)), total }
    }

    async recent(recipientId: string, limit: number): Promise<NotificationItem[]> {
        const rows = await this.prisma.notification.findMany({
            where: { recipientId },
            orderBy: { createdAt: 'desc' },
            take: limit
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return rows.map((r: any) => this.toItem(r))
    }

    unreadCount(recipientId: string): Promise<number> {
        return this.prisma.notification.count({ where: { recipientId, readAt: null } })
    }

    async markRead(id: string, recipientId: string): Promise<void> {
        // updateMany (not update) so a non-owner id is a silent no-op, not a throw.
        await this.prisma.notification.updateMany({
            where: { id, recipientId, readAt: null },
            data: { readAt: new Date() }
        })
    }

    async markAllRead(recipientId: string): Promise<void> {
        await this.prisma.notification.updateMany({
            where: { recipientId, readAt: null },
            data: { readAt: new Date() }
        })
    }

    async markEmailSent(id: string): Promise<void> {
        await this.prisma.notification.update({ where: { id }, data: { emailSent: true } })
    }

    async findAdminIds(): Promise<string[]> {
        const rows = await this.prisma.user.findMany({
            where: { isAdmin: true, deletedAt: null },
            select: { id: true }
        })
        return rows.map((r) => r.id)
    }

    async findRecipientEmail(userId: string): Promise<string | null> {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
        return user?.email ?? null
    }

    async findEmailRecipient(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                email: true,
                emailNotificationsEnabled: true,
                emailOrders: true,
                emailDisputes: true,
                emailGigs: true
            }
        })
        if (!user) return null
        return {
            email: user.email ?? null,
            prefs: {
                emailNotificationsEnabled: user.emailNotificationsEnabled,
                emailOrders: user.emailOrders,
                emailDisputes: user.emailDisputes,
                emailGigs: user.emailGigs
            }
        }
    }

    async findDisplayName(userId: string): Promise<string | null> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { displayName: true, username: true }
        })
        return user?.displayName ?? user?.username ?? null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toItem(r: any): NotificationItem {
        return {
            id: r.id,
            recipientId: r.recipientId,
            type: r.type as NotificationType,
            data: (r.data ?? {}) as NotificationData,
            readAt: r.readAt ?? null,
            emailSent: r.emailSent,
            createdAt: r.createdAt
        }
    }
}
