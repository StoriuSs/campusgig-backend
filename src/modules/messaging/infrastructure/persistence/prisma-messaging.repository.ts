import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import {
    AttachmentItem,
    ConversationListItem,
    FileItem,
    MessageItem,
    MessagingRepositoryPort,
    StagedAttachment,
    PRESENCE_PORT,
    PresencePort
} from '../../domain/ports'
import { Inject } from '@nestjs/common'

// Normalize pair so the (userAId, userBId) unique covers both directions.
function normalizePair(a: string, b: string): { userAId: string; userBId: string } {
    return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a }
}

@Injectable()
export class PrismaMessagingRepository implements MessagingRepositoryPort {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(PRESENCE_PORT) private readonly presence: PresencePort
    ) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toAttachment(a: any): AttachmentItem {
        return {
            id: a.id,
            key: a.key,
            name: a.name,
            size: a.size,
            mime: a.mime
        }
    }

    private toMessage(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m: any,
        peerCursor: { lastReadAt: Date } | null
    ): MessageItem {
        const readByRecipient = !!peerCursor && peerCursor.lastReadAt.getTime() >= m.createdAt.getTime()
        return {
            id: m.id,
            threadId: m.threadId,
            senderId: m.senderId,
            body: m.body,
            orderId: m.orderId,
            createdAt: m.createdAt,
            attachments: (m.attachments ?? []).map((a: unknown) => this.toAttachment(a)),
            readByRecipient
        }
    }

    async createOrGetThread(userAId: string, userBId: string): Promise<{ id: string; createdNow: boolean }> {
        const pair = normalizePair(userAId, userBId)
        const existing = await this.prisma.messageThread.findUnique({
            where: { userAId_userBId: { userAId: pair.userAId, userBId: pair.userBId } }
        })
        if (existing) return { id: existing.id, createdNow: false }

        const created = await this.prisma.messageThread.create({
            data: { userAId: pair.userAId, userBId: pair.userBId }
        })
        return { id: created.id, createdNow: true }
    }

    async getThreadById(threadId: string, viewerId: string): Promise<{ id: string; otherUserId: string } | null> {
        const thread = await this.prisma.messageThread.findUnique({
            where: { id: threadId },
            select: { id: true, userAId: true, userBId: true }
        })
        if (!thread) return null
        if (thread.userAId !== viewerId && thread.userBId !== viewerId) return null
        const otherUserId = thread.userAId === viewerId ? thread.userBId : thread.userAId
        return { id: thread.id, otherUserId }
    }

    async listConversations(
        viewerId: string,
        page: number,
        pageSize: number
    ): Promise<{ items: ConversationListItem[]; total: number }> {
        const skip = (page - 1) * pageSize

        const [total, threads] = await Promise.all([
            this.prisma.messageThread.count({
                where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] }
            }),
            this.prisma.messageThread.findMany({
                where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
                orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
                skip,
                take: pageSize,
                select: {
                    id: true,
                    userAId: true,
                    userBId: true,
                    userA: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true,
                            lastSeenAt: true
                        }
                    },
                    userB: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true,
                            lastSeenAt: true
                        }
                    },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: {
                            body: true,
                            senderId: true,
                            createdAt: true,
                            attachments: { select: { id: true }, take: 1 }
                        }
                    },
                    readCursors: {
                        where: { userId: viewerId },
                        select: { lastReadAt: true }
                    }
                }
            })
        ])

        const threadIds = threads.map((t) => t.id)

        const unreadCounts = new Map<string, number>()
        if (threadIds.length > 0) {
            const raw = await this.prisma.$queryRaw<Array<{ threadId: string; count: bigint }>>`
                SELECT m."threadId" as "threadId", COUNT(*)::bigint as count
                FROM "Message" m
                LEFT JOIN "MessageReadCursor" c
                  ON c."threadId" = m."threadId" AND c."userId" = ${viewerId}
                WHERE m."threadId" = ANY(${threadIds}::text[])
                  AND m."senderId" IS NOT NULL
                  AND m."senderId" != ${viewerId}
                  AND (c."lastReadAt" IS NULL OR m."createdAt" > c."lastReadAt")
                GROUP BY m."threadId"
            `
            for (const row of raw) {
                unreadCounts.set(row.threadId, Number(row.count))
            }
        }

        const otherUserIds = threads.map((t) => (t.userAId === viewerId ? t.userBId : t.userAId))
        const onlineSet = await this.presence.filterOnline(otherUserIds)

        const items: ConversationListItem[] = threads.map((t) => {
            const other = t.userAId === viewerId ? t.userB : t.userA
            const last = t.messages[0]
            return {
                threadId: t.id,
                otherUser: {
                    id: other.id,
                    username: other.username,
                    displayName: other.displayName,
                    avatarKey: other.avatarUrl
                },
                lastMessage: last
                    ? {
                          body: last.body,
                          senderId: last.senderId,
                          createdAt: last.createdAt,
                          hasAttachments: last.attachments.length > 0
                      }
                    : null,
                unreadCount: unreadCounts.get(t.id) ?? 0,
                online: onlineSet.has(other.id),
                lastSeenAt: other.lastSeenAt
            }
        })

        return { items, total }
    }

    async listMessages(
        threadId: string,
        beforeId: string | null,
        pageSize: number,
        opts?: { orderId?: string }
    ): Promise<MessageItem[]> {
        // Cursor: createdAt < before.createdAt OR (eq AND id < before.id)
        let beforeRow: { createdAt: Date; id: string } | null = null
        if (beforeId) {
            beforeRow = await this.prisma.message.findUnique({
                where: { id: beforeId },
                select: { createdAt: true, id: true }
            })
        }

        // Workspace view: system events tagged to this order always show; user
        // messages limited to [placedAt, terminalAt or now]. Inbox view: full thread.
        let userMsgWindow: { gte: Date; lte?: Date } | null = null
        if (opts?.orderId) {
            const order = await this.prisma.order.findUnique({
                where: { id: opts.orderId },
                select: {
                    placedAt: true,
                    status: true,
                    completedAt: true,
                    cancelledAt: true
                }
            })
            if (!order) return []
            const terminalAt: Date | null =
                order.status === 'Completed'
                    ? order.completedAt
                    : order.status === 'Cancelled'
                      ? order.cancelledAt
                      : null
            userMsgWindow = {
                gte: order.placedAt,
                ...(terminalAt ? { lte: terminalAt } : {})
            }
        }

        const scopeFilter = opts?.orderId
            ? {
                  OR: [
                      { senderId: null, orderId: opts.orderId },
                      {
                          senderId: { not: null },
                          createdAt: userMsgWindow as { gte: Date; lte?: Date }
                      }
                  ]
              }
            : {}

        const messages = await this.prisma.message.findMany({
            where: {
                threadId,
                ...scopeFilter,
                ...(beforeRow
                    ? {
                          AND: [
                              {
                                  OR: [
                                      { createdAt: { lt: beforeRow.createdAt } },
                                      { createdAt: beforeRow.createdAt, id: { lt: beforeRow.id } }
                                  ]
                              }
                          ]
                      }
                    : {})
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: pageSize,
            include: { attachments: true }
        })

        if (messages.length === 0) return []

        // readByRecipient: msg is read iff the OTHER participant's cursor.lastReadAt >= msg.createdAt.
        const cursors = await this.prisma.messageReadCursor.findMany({
            where: { threadId },
            select: { userId: true, lastReadAt: true }
        })

        return messages.map((m) => {
            if (!m.senderId) return this.toMessage(m, null)
            const other = cursors.find((c) => c.userId !== m.senderId) ?? null
            return this.toMessage(m, other)
        })
    }

    async insertMessage(input: {
        threadId: string
        senderId: string
        body: string | null
        orderId: string | null
        attachmentIds: string[]
    }): Promise<MessageItem> {
        const now = new Date()
        const result = await this.prisma.$transaction(async (tx) => {
            const message = await tx.message.create({
                data: {
                    threadId: input.threadId,
                    senderId: input.senderId,
                    body: input.body,
                    orderId: input.orderId,
                    createdAt: now
                }
            })

            if (input.attachmentIds.length > 0) {
                await tx.messageAttachment.updateMany({
                    where: {
                        id: { in: input.attachmentIds },
                        messageId: null
                    },
                    data: { messageId: message.id }
                })
            }

            await tx.messageThread.update({
                where: { id: input.threadId },
                data: { lastMessageAt: now }
            })

            const full = await tx.message.findUnique({
                where: { id: message.id },
                include: { attachments: true }
            })
            return full!
        })

        return this.toMessage(result, null)
    }

    async insertSystemEvent(input: {
        threadId: string
        orderId: string
        type: string
        payload: Record<string, unknown>
        at: Date
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    }): Promise<MessageItem> {
        // Use caller's tx (atomic with the Order state flip) when supplied.
        const client = input.tx ?? this.prisma
        const body = JSON.stringify({ type: input.type, payload: input.payload })

        const message = await client.message.create({
            data: {
                threadId: input.threadId,
                senderId: null, // system event marker
                body,
                orderId: input.orderId,
                createdAt: input.at
            }
        })
        // Don't bump lastMessageAt — Inbox sidebar excludes system events.
        return this.toMessage({ ...message, attachments: [] }, null)
    }

    async getMessageById(messageId: string, viewerId: string): Promise<MessageItem | null> {
        const m = await this.prisma.message.findUnique({
            where: { id: messageId },
            include: {
                attachments: true,
                thread: { select: { userAId: true, userBId: true } }
            }
        })
        if (!m) return null
        if (m.thread.userAId !== viewerId && m.thread.userBId !== viewerId) return null
        return this.toMessage(m, null)
    }

    async markThreadRead(threadId: string, userId: string): Promise<{ unreadCleared: number; lastReadAt: Date }> {
        const now = new Date()

        const latest = await this.prisma.message.findFirst({
            where: { threadId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { id: true }
        })

        const prev = await this.prisma.messageReadCursor.findUnique({
            where: { threadId_userId: { threadId, userId } },
            select: { lastReadAt: true }
        })

        const unreadCleared = await this.prisma.message.count({
            where: {
                threadId,
                // Peer-sent only — exclude system events and own sends.
                AND: [{ senderId: { not: null } }, { senderId: { not: userId } }],
                ...(prev?.lastReadAt ? { createdAt: { gt: prev.lastReadAt } } : {})
            }
        })

        await this.prisma.messageReadCursor.upsert({
            where: { threadId_userId: { threadId, userId } },
            create: {
                threadId,
                userId,
                lastReadMessageId: latest?.id ?? null,
                lastReadAt: now
            },
            update: {
                lastReadMessageId: latest?.id ?? null,
                lastReadAt: now
            }
        })

        return { unreadCleared, lastReadAt: now }
    }

    async getUnreadCount(userId: string): Promise<number> {
        // Counts THREADS with at least one unread peer message, not individual messages.
        const raw = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT m."threadId")::bigint as count
            FROM "Message" m
            JOIN "MessageThread" t ON m."threadId" = t.id
            LEFT JOIN "MessageReadCursor" c
              ON c."threadId" = m."threadId" AND c."userId" = ${userId}
            WHERE (t."userAId" = ${userId} OR t."userBId" = ${userId})
              AND m."senderId" IS NOT NULL
              AND m."senderId" != ${userId}
              AND (c."lastReadAt" IS NULL OR m."createdAt" > c."lastReadAt")
        `
        return raw[0] ? Number(raw[0].count) : 0
    }

    async listThreadFiles(threadId: string, _viewerId: string, opts?: { orderId?: string }): Promise<FileItem[]> {
        // Order-scoped: filter by message.createdAt in the order's active window.
        // Can't filter by message.orderId — workspace messages aren't tagged post unified-thread refactor.
        let messageWhere: {
            threadId: string
            createdAt?: { gte: Date; lte?: Date }
        } = { threadId }
        if (opts?.orderId) {
            const order = await this.prisma.order.findUnique({
                where: { id: opts.orderId },
                select: {
                    placedAt: true,
                    status: true,
                    completedAt: true,
                    cancelledAt: true
                }
            })
            if (!order) return []
            const terminalAt: Date | null =
                order.status === 'Completed'
                    ? order.completedAt
                    : order.status === 'Cancelled'
                      ? order.cancelledAt
                      : null
            messageWhere = {
                threadId,
                createdAt: {
                    gte: order.placedAt,
                    ...(terminalAt ? { lte: terminalAt } : {})
                }
            }
        }
        const attachments = await this.prisma.messageAttachment.findMany({
            where: {
                messageId: { not: null },
                message: messageWhere
            },
            include: {
                message: {
                    include: {
                        sender: {
                            select: { id: true, displayName: true, username: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return attachments.map((a) => ({
            id: a.id,
            key: a.key,
            name: a.name,
            size: a.size,
            mime: a.mime,
            messageId: a.messageId!,
            senderId: a.message?.senderId ?? null,
            senderName: a.message?.sender?.displayName ?? a.message?.sender?.username ?? null,
            createdAt: a.createdAt
        }))
    }

    async stageAttachment(input: {
        senderId: string
        key: string
        name: string
        size: number
        mime: string
    }): Promise<StagedAttachment> {
        const row = await this.prisma.messageAttachment.create({
            data: {
                messageId: null,
                key: input.key,
                name: input.name,
                size: input.size,
                mime: input.mime
            }
        })
        return {
            id: row.id,
            key: row.key,
            name: row.name,
            size: row.size,
            mime: row.mime
        }
    }

    async getAttachmentForResolve(
        attachmentId: string,
        viewerId: string
    ): Promise<{ id: string; key: string; name: string } | null> {
        const a = await this.prisma.messageAttachment.findUnique({
            where: { id: attachmentId },
            include: {
                message: {
                    include: {
                        thread: { select: { userAId: true, userBId: true } }
                    }
                }
            }
        })
        if (!a) return null

        // Staged attachment has no uploader pointer; staged use is single-Send-call only.
        if (!a.message) {
            return null
        }

        const thread = a.message.thread
        if (thread.userAId !== viewerId && thread.userBId !== viewerId) return null
        return { id: a.id, key: a.key, name: a.name }
    }

    async getResponseTimeSamples(
        userId: string,
        days: number
    ): Promise<{ medianSeconds: number | null; sampleCount: number }> {
        // One sample per "session": gap between first inbound after prev outbound and current outbound.
        // Capped at 24h so a vacation reply doesn't poison the median.
        const raw = await this.prisma.$queryRaw<Array<{ sample_count: bigint; median_seconds: string | null }>>`
            WITH outbounds AS (
                SELECT
                    m."threadId" AS thread_id,
                    m."createdAt" AS out_at,
                    LAG(m."createdAt") OVER (
                        PARTITION BY m."threadId"
                        ORDER BY m."createdAt"
                    ) AS prev_out_at
                FROM "Message" m
                JOIN "MessageThread" t ON t.id = m."threadId"
                WHERE m."senderId" = ${userId}
                  AND (t."userAId" = ${userId} OR t."userBId" = ${userId})
                  AND m."createdAt" > NOW() - (${days}::int * INTERVAL '1 day')
            ),
            sessions AS (
                SELECT
                    o.out_at,
                    (
                        SELECT MIN(im."createdAt")
                        FROM "Message" im
                        WHERE im."threadId" = o.thread_id
                          AND im."senderId" IS NOT NULL
                          AND im."senderId" != ${userId}
                          AND im."createdAt" < o.out_at
                          AND (o.prev_out_at IS NULL OR im."createdAt" > o.prev_out_at)
                    ) AS first_in_at
                FROM outbounds o
            ),
            diffs AS (
                SELECT LEAST(
                    EXTRACT(EPOCH FROM (out_at - first_in_at)),
                    86400::numeric
                ) AS gap_seconds
                FROM sessions
                WHERE first_in_at IS NOT NULL
            )
            SELECT
                COUNT(*)::bigint AS sample_count,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_seconds)::text AS median_seconds
            FROM diffs;
        `
        const row = raw[0]
        if (!row) return { medianSeconds: null, sampleCount: 0 }
        const sampleCount = Number(row.sample_count)
        const medianSeconds = row.median_seconds != null ? Number(row.median_seconds) : null
        return { medianSeconds, sampleCount }
    }

    async setLastSeen(userId: string, at: Date): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastSeenAt: at }
        })
    }

    async listThreadPeers(userId: string): Promise<string[]> {
        const threads = await this.prisma.messageThread.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            select: { userAId: true, userBId: true }
        })
        const peers = new Set<string>()
        for (const t of threads) {
            peers.add(t.userAId === userId ? t.userBId : t.userAId)
        }
        return Array.from(peers)
    }
}
