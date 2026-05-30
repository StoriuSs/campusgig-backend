import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'
import { formatOrderCode } from '@/shared/utils'
import { PLATFORM_FEE_COLLECTOR_USER_ID } from '@/shared/constants/platform'
import { MESSAGING_REPOSITORY_PORT, MessageItem, MessagingRepositoryPort } from '@/modules/messaging/domain/ports'
import { SocketEmitter } from '@/modules/messaging/application/events/handlers'
import { WALLET_REPOSITORY_PORT, WalletRepositoryPort } from '@/modules/wallet/domain/ports/wallet.repository.port'

import {
    CancellationItem,
    DeliveryItem,
    DeliveryFileItem,
    ExtensionItem,
    MoneyMoveRefs,
    OrderDetail,
    OrderEventItem,
    OrderListRow,
    OrderStatus,
    OrderStatusCounts,
    OrdersRepositoryPort,
    OrdersSort
} from '../../domain/ports'
import {
    DeclineNoteTooShortException,
    GigNotPurchasableException,
    InsufficientWalletBalanceException,
    InvalidTransitionException,
    NotAParticipantException,
    OrderNotFoundException,
    SellerCannotOrderOwnGigException
} from '../../domain/exceptions'
import { OrderJobsScheduler } from '../jobs/order-jobs.scheduler'

const PLATFORM_FEE_PCT = 20

// Renders the actor's short display name for the chat system-event pill.
// Falls back to username then to "User" if both are missing (shouldn't happen
// at the point of inserts since we always have a logged-in actor).
function actorName(user: { displayName: string | null; username: string | null } | null | undefined): string {
    if (!user) return 'User'
    const dn = user.displayName?.trim()
    if (dn) return dn
    return user.username ?? 'User'
}

// Hours → ms
const ACCEPT_WINDOW_MS = 24 * 60 * 60 * 1000
const REVIEW_WINDOW_MS = 72 * 60 * 60 * 1000
const DISPUTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const EXTENSION_WINDOW_MS = 24 * 60 * 60 * 1000
const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000

@Injectable()
export class PrismaOrdersRepository implements OrdersRepositoryPort {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(WALLET_REPOSITORY_PORT)
        private readonly walletRepo: WalletRepositoryPort,
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly messagingRepo: MessagingRepositoryPort,
        private readonly jobs: OrderJobsScheduler,
        // Pushes system-event chat pills (order_placed, order_accepted, …) to
        // both parties in real time. Emission happens AFTER the $transaction
        // commits so a rolled-back transaction never publishes a phantom
        // message. Same wire shape as the messaging module's existing
        // `message:new` event so the workspace chat panel needs no new
        // handler — it just appends the message as it does for chat replies.
        private readonly socketEmitter: SocketEmitter
    ) {}

    // Broadcast the just-persisted system event to the buyer↔seller thread
    // room. Shape mirrors MessageSentSocketHandler; system events have no
    // attachments and are unread-by-recipient by definition (they have no
    // sender to "read" them on the other side).
    private emitSystemEventMessage(threadId: string, message: MessageItem): void {
        const wirePayload = {
            threadId,
            message: {
                id: message.id,
                threadId: message.threadId,
                senderId: message.senderId,
                body: message.body,
                orderId: message.orderId,
                createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
                attachments: [],
                readByRecipient: false
            }
        }
        this.socketEmitter.emitToThread(threadId, 'message:new', wirePayload)
    }

    // ── Mappers ────────────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toParty(u: any) {
        return {
            id: u.id,
            username: u.username ?? null,
            displayName: u.displayName ?? null,
            avatarKey: u.avatarUrl ?? null,
            endorsedAt: u.endorsedAt ?? null
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toOrderItem(o: any): OrderDetail {
        const latestDelivery = (o.deliveries ?? [])[0] ?? null
        const pendingExtension = (o.extensions ?? []).find((e: { status: string }) => e.status === 'Pending') ?? null
        const pendingCancellation =
            (o.cancellations ?? []).find((c: { status: string }) => c.status === 'Pending') ?? null
        return {
            id: o.id,
            number: o.number,
            status: o.status as OrderStatus,
            buyer: this.toParty(o.buyer),
            seller: this.toParty(o.seller),
            gig: {
                id: o.gigId,
                titleSnapshot: o.gigTitleSnapshot,
                priceVndSnapshot: o.gigPriceVndSnapshot,
                deliveryDays: o.gigDeliveryDays,
                coverKey: o.gigCoverKey ?? null
            },
            placedAt: o.placedAt,
            acceptedAt: o.acceptedAt ?? null,
            deliveredAt: o.deliveredAt ?? null,
            completedAt: o.completedAt ?? null,
            cancelledAt: o.cancelledAt ?? null,
            autoCompletedAt: o.autoCompletedAt ?? null,
            acceptDeadline: o.acceptDeadline ?? null,
            deliveryDeadline: o.deliveryDeadline ?? null,
            reviewDeadline: o.reviewDeadline ?? null,
            disputeDeadline: o.disputeDeadline ?? null,
            cancelledByUserId: o.cancelledByUserId ?? null,
            cancellationReason: o.cancellationReason ?? null,
            latestDelivery: latestDelivery ? this.toDelivery(latestDelivery) : null,
            pendingExtension: pendingExtension ? this.toExtension(pendingExtension) : null,
            pendingCancellation: pendingCancellation ? this.toCancellation(pendingCancellation) : null,
            deliveryCount: (o.deliveries ?? []).length
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toDelivery(d: any): DeliveryItem {
        return {
            id: d.id,
            orderId: d.orderId,
            version: d.version,
            note: d.note,
            deliveredAt: d.deliveredAt,
            files: (d.files ?? []).map((f: { [k: string]: unknown }) => ({
                id: f.id as string,
                name: f.name as string,
                size: f.size as number,
                mime: f.mime as string,
                createdAt: f.createdAt as Date
            }))
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toExtension(e: any): ExtensionItem {
        return {
            id: e.id,
            orderId: e.orderId,
            requestedById: e.requestedById,
            daysRequested: e.daysRequested,
            reason: e.reason ?? null,
            status: e.status,
            expiresAt: e.expiresAt,
            requestedAt: e.requestedAt,
            decidedAt: e.decidedAt ?? null,
            decidedById: e.decidedById ?? null
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toCancellation(c: any): CancellationItem {
        return {
            id: c.id,
            orderId: c.orderId,
            requestedById: c.requestedById,
            initiator: c.initiator,
            reasonCode: c.reasonCode,
            otherText: c.otherText ?? null,
            status: c.status,
            expiresAt: c.expiresAt,
            requestedAt: c.requestedAt,
            decidedAt: c.decidedAt ?? null,
            decidedById: c.decidedById ?? null
        }
    }

    // ── Default includes ───────────────────────────────────────────────────

    private get orderIncludes() {
        return {
            buyer: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    endorsedAt: true
                }
            },
            seller: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    endorsedAt: true
                }
            },
            deliveries: {
                orderBy: { version: 'desc' as const },
                take: 1,
                include: { files: true }
            },
            extensions: {
                where: { status: 'Pending' as const },
                orderBy: { requestedAt: 'desc' as const },
                take: 1
            },
            cancellations: {
                where: { status: 'Pending' as const },
                orderBy: { requestedAt: 'desc' as const },
                take: 1
            }
        }
    }

    // ── Reads ──────────────────────────────────────────────────────────────

    async findByIdForViewer(orderId: string, viewerId: string): Promise<OrderDetail | null> {
        const o = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                ...this.orderIncludes,
                deliveries: {
                    orderBy: { version: 'desc' as const },
                    include: { files: true }
                }
            }
        })
        if (!o) return null
        if (o.buyerId !== viewerId && o.sellerId !== viewerId) return null
        return this.toOrderItem(o)
    }

    async listForUser(input: {
        viewerId: string
        side: 'buyer' | 'seller'
        statusFilter: OrderStatus | 'all'
        actionRequiredOnly: boolean
        query: string | null
        sort: OrdersSort
        page: number
        pageSize: number
    }): Promise<{ items: OrderListRow[]; total: number; counts: OrderStatusCounts }> {
        const partyFilter = input.side === 'buyer' ? { buyerId: input.viewerId } : { sellerId: input.viewerId }

        const statusWhere = input.statusFilter === 'all' ? {} : { status: input.statusFilter }

        const qTrim = input.query?.trim()
        const queryWhere = qTrim
            ? {
                  OR: [
                      { gigTitleSnapshot: { contains: qTrim, mode: 'insensitive' as const } },
                      { buyer: { displayName: { contains: qTrim, mode: 'insensitive' as const } } },
                      { seller: { displayName: { contains: qTrim, mode: 'insensitive' as const } } },
                      ...(numericLike(qTrim) ? [{ number: Number.parseInt(qTrim, 10) }] : [])
                  ]
              }
            : {}

        const where = { ...partyFilter, ...statusWhere, ...queryWhere }

        // Counts pass — one $queryRaw groups by status. Cheap because
        // (buyerId|sellerId, status, placedAt) index satisfies the partition.
        const rawCounts = await this.prisma.order.groupBy({
            by: ['status'],
            where: { ...partyFilter, ...queryWhere },
            _count: { _all: true }
        })
        const counts: OrderStatusCounts = {
            all: 0,
            PendingReview: 0,
            InProgress: 0,
            Late: 0,
            Delivered: 0,
            AwaitingFinalization: 0,
            Completed: 0,
            Cancelled: 0
        }
        for (const row of rawCounts) {
            const s = row.status as keyof OrderStatusCounts
            if (s in counts) counts[s] = row._count._all
            counts.all += row._count._all
        }

        const orderBy = sortToOrderBy(input.sort)
        const rows = await this.prisma.order.findMany({
            where,
            orderBy,
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            include: {
                buyer: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
                seller: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
                extensions: {
                    where: { status: 'Pending' as const },
                    orderBy: { requestedAt: 'desc' as const },
                    take: 1,
                    select: { expiresAt: true, requestedById: true }
                },
                cancellations: {
                    where: { status: 'Pending' as const },
                    orderBy: { requestedAt: 'desc' as const },
                    take: 1,
                    select: { expiresAt: true, initiator: true, requestedById: true }
                }
            }
        })

        const items: OrderListRow[] = rows.map((o) => {
            const counterparty = input.side === 'buyer' ? o.seller : o.buyer
            const pendingExt = o.extensions[0] ?? null
            const pendingCancel = o.cancellations[0] ?? null
            return {
                id: o.id,
                number: o.number,
                status: o.status as OrderStatus,
                gigTitle: o.gigTitleSnapshot,
                gigCoverKey: o.gigCoverKey ?? null,
                counterpartyId: counterparty.id,
                counterpartyDisplayName: counterparty.displayName,
                counterpartyUsername: counterparty.username,
                counterpartyAvatarKey: counterparty.avatarUrl,
                placedAt: o.placedAt,
                amountVnd: o.gigPriceVndSnapshot,
                acceptDeadline: o.acceptDeadline,
                deliveryDeadline: o.deliveryDeadline,
                reviewDeadline: o.reviewDeadline,
                disputeDeadline: o.disputeDeadline,
                pendingExtensionExpiresAt: pendingExt?.expiresAt ?? null,
                pendingCancellationExpiresAt: pendingCancel?.expiresAt ?? null,
                pendingCancellationInitiator: pendingCancel?.initiator ?? null,
                actionRequired: this.computeActionRequired({
                    status: o.status as OrderStatus,
                    side: input.side,
                    pendingExt: !!pendingExt,
                    pendingExtRequestedById: pendingExt?.requestedById ?? null,
                    pendingCancel: !!pendingCancel,
                    pendingCancelInitiator: pendingCancel?.initiator ?? null,
                    viewerId: input.viewerId,
                    sellerId: o.sellerId,
                    buyerId: o.buyerId
                })
            }
        })

        // The actionRequiredOnly filter is applied AFTER mapping because the
        // computation depends on the viewer-role join we just resolved.
        // Strict `=== true` guard keeps the repo defensive even if a caller
        // ever passes a non-boolean by mistake — the global ValidationPipe's
        // implicit conversion of boolean fields is famously friendly to
        // truthy strings (`Boolean('false') === true`), so the orders DTO
        // accepts the wire string verbatim and the controller normalizes it.
        const filtered = input.actionRequiredOnly === true ? items.filter((r) => r.actionRequired) : items

        return {
            items: filtered,
            total: counts.all, // total across all statuses for this side
            counts
        }
    }

    private computeActionRequired(args: {
        status: OrderStatus
        side: 'buyer' | 'seller'
        pendingExt: boolean
        pendingExtRequestedById: string | null
        pendingCancel: boolean
        pendingCancelInitiator: 'Buyer' | 'Seller' | null
        viewerId: string
        sellerId: string
        buyerId: string
    }): boolean {
        // Per SRS § Order Lifecycle action-required-dot rules
        if (args.status === 'PendingReview' && args.side === 'seller') return true
        if (args.status === 'Delivered' && args.side === 'buyer') return true
        if (args.status === 'InProgress' || args.status === 'Late') {
            if (args.pendingExt && args.side === 'buyer') return true
            if (args.pendingCancel) {
                // The decider is whoever DIDN'T request.
                if (args.pendingCancelInitiator === 'Buyer' && args.side === 'seller') return true
                if (args.pendingCancelInitiator === 'Seller' && args.side === 'buyer') return true
            }
        }
        return false
    }

    async listEvents(orderId: string, viewerId: string): Promise<OrderEventItem[]> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { buyerId: true, sellerId: true }
        })
        if (!order) return []
        if (order.buyerId !== viewerId && order.sellerId !== viewerId) return []
        const events = await this.prisma.orderEvent.findMany({
            where: { orderId },
            orderBy: { createdAt: 'asc' }
        })
        return events.map((e) => ({
            id: e.id,
            orderId: e.orderId,
            type: e.type,
            actorUserId: e.actorUserId ?? null,
            payload: (e.payload as Record<string, unknown> | null) ?? null,
            createdAt: e.createdAt
        }))
    }

    async countActionRequired(viewerId: string): Promise<{ asBuyer: number; asSeller: number }> {
        // Cheap version: load (id, status, side) rows that COULD be action-
        // required, then filter in JS. The orderId-key counts are small at
        // campus scale.
        const [asBuyerRows, asSellerRows] = await Promise.all([
            this.prisma.order.findMany({
                where: { buyerId: viewerId, status: { in: ['Delivered', 'InProgress', 'Late'] } },
                include: {
                    extensions: { where: { status: 'Pending' }, take: 1 },
                    cancellations: { where: { status: 'Pending' }, take: 1 }
                }
            }),
            this.prisma.order.findMany({
                where: {
                    sellerId: viewerId,
                    status: { in: ['PendingReview', 'InProgress', 'Late'] }
                },
                include: {
                    cancellations: { where: { status: 'Pending' }, take: 1 }
                }
            })
        ])

        const asBuyer = asBuyerRows.filter((o) => {
            if (o.status === 'Delivered') return true
            if (o.extensions.length > 0) return true
            if (o.cancellations.length > 0 && o.cancellations[0].initiator === 'Seller') return true
            return false
        }).length
        const asSeller = asSellerRows.filter((o) => {
            if (o.status === 'PendingReview') return true
            if (o.cancellations.length > 0 && o.cancellations[0].initiator === 'Buyer') return true
            return false
        }).length

        return { asBuyer, asSeller }
    }

    async listActiveBetween(viewerId: string, otherUserId: string): Promise<OrderListRow[]> {
        // Active orders between the viewer and one specific counterparty, in
        // either direction. Returns rows in the same shape as listForUser so
        // the Inbox header banner can render the same OrderListRow type.
        const rows = await this.prisma.order.findMany({
            where: {
                status: {
                    notIn: ['Completed', 'Cancelled']
                },
                OR: [
                    { buyerId: viewerId, sellerId: otherUserId },
                    { buyerId: otherUserId, sellerId: viewerId }
                ]
            },
            orderBy: [{ placedAt: 'desc' as const }],
            // Reasonable cap — a single pair shouldn't have dozens of
            // concurrent active orders. If they do, the inbox can show the
            // most recent few and the user opens /orders to see the rest.
            take: 10,
            include: {
                buyer: {
                    select: { id: true, displayName: true, username: true, avatarUrl: true }
                },
                seller: {
                    select: { id: true, displayName: true, username: true, avatarUrl: true }
                },
                extensions: {
                    where: { status: 'Pending' as const },
                    orderBy: { requestedAt: 'desc' as const },
                    take: 1,
                    select: { expiresAt: true, requestedById: true }
                },
                cancellations: {
                    where: { status: 'Pending' as const },
                    orderBy: { requestedAt: 'desc' as const },
                    take: 1,
                    select: { expiresAt: true, initiator: true, requestedById: true }
                }
            }
        })

        return rows.map((o) => {
            const side: 'buyer' | 'seller' = o.buyerId === viewerId ? 'buyer' : 'seller'
            const counterparty = side === 'buyer' ? o.seller : o.buyer
            const pendingExt = o.extensions[0] ?? null
            const pendingCancel = o.cancellations[0] ?? null
            return {
                id: o.id,
                number: o.number,
                status: o.status as OrderStatus,
                gigTitle: o.gigTitleSnapshot,
                gigCoverKey: o.gigCoverKey ?? null,
                counterpartyId: counterparty.id,
                counterpartyDisplayName: counterparty.displayName,
                counterpartyUsername: counterparty.username,
                counterpartyAvatarKey: counterparty.avatarUrl,
                placedAt: o.placedAt,
                amountVnd: o.gigPriceVndSnapshot,
                acceptDeadline: o.acceptDeadline,
                deliveryDeadline: o.deliveryDeadline,
                reviewDeadline: o.reviewDeadline,
                disputeDeadline: o.disputeDeadline,
                pendingExtensionExpiresAt: pendingExt?.expiresAt ?? null,
                pendingCancellationExpiresAt: pendingCancel?.expiresAt ?? null,
                pendingCancellationInitiator: pendingCancel?.initiator ?? null,
                actionRequired: this.computeActionRequired({
                    status: o.status as OrderStatus,
                    side,
                    pendingExt: !!pendingExt,
                    pendingExtRequestedById: pendingExt?.requestedById ?? null,
                    pendingCancel: !!pendingCancel,
                    pendingCancelInitiator: pendingCancel?.initiator ?? null,
                    viewerId,
                    sellerId: o.sellerId,
                    buyerId: o.buyerId
                })
            }
        })
    }

    async listDeliveries(orderId: string, viewerId: string): Promise<DeliveryItem[]> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { buyerId: true, sellerId: true }
        })
        if (!order) return []
        if (order.buyerId !== viewerId && order.sellerId !== viewerId) return []
        const deliveries = await this.prisma.delivery.findMany({
            where: { orderId },
            orderBy: { version: 'desc' },
            include: { files: true }
        })
        return deliveries.map((d) => this.toDelivery(d))
    }

    async getDeliveryFileForResolve(
        orderId: string,
        deliveryId: string,
        fileId: string,
        viewerId: string
    ): Promise<{ id: string; key: string; name: string } | null> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { buyerId: true, sellerId: true }
        })
        if (!order) return null
        if (order.buyerId !== viewerId && order.sellerId !== viewerId) return null
        const file = await this.prisma.deliveryFile.findUnique({
            where: { id: fileId },
            include: { delivery: { select: { orderId: true } } }
        })
        if (!file || file.delivery?.orderId !== orderId || file.deliveryId !== deliveryId) return null
        return { id: file.id, key: file.key, name: file.name }
    }

    async stageDeliveryFile(input: {
        sellerId: string
        orderId: string
        key: string
        name: string
        size: number
        mime: string
    }): Promise<DeliveryFileItem> {
        const row = await this.prisma.deliveryFile.create({
            data: {
                deliveryId: null,
                key: input.key,
                name: input.name,
                size: input.size,
                mime: input.mime
            }
        })
        return {
            id: row.id,
            name: row.name,
            size: row.size,
            mime: row.mime,
            createdAt: row.createdAt
        }
    }

    // ── Transitions ────────────────────────────────────────────────────────
    // All transitions are wrapped in $transaction with a status guard. Wallet
    // ops + system message inserts share the same `tx` client so everything
    // commits atomically.

    async placeOrder(input: {
        buyerId: string
        gigId: string
        idempotencyKey: string
    }): Promise<{ order: OrderDetail; refs: MoneyMoveRefs }> {
        // Pre-flight reads outside the transaction (cheap, no row-level lock
        // contention). The wallet balance check runs again inside the tx —
        // the second check is the authoritative one against a race.
        const gig = await this.prisma.gig.findUnique({
            where: { id: input.gigId },
            select: {
                id: true,
                title: true,
                priceVnd: true,
                deliveryDays: true,
                status: true,
                sellerId: true,
                images: {
                    where: { position: 0 },
                    take: 1,
                    select: { imageKey: true }
                }
            }
        })
        if (!gig) throw new GigNotPurchasableException(input.gigId, 'NotFound')
        if (gig.status !== 'Active') {
            throw new GigNotPurchasableException(input.gigId, `Gig is ${gig.status}`)
        }
        if (gig.sellerId === input.buyerId) {
            throw new SellerCannotOrderOwnGigException(input.gigId, input.buyerId)
        }

        // Captured INSIDE the tx callback, emitted AFTER the tx commits.
        // Keeps system-event sockets and DB rows consistent: if the tx
        // rolls back, $transaction throws and we never reach the emit line.
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null

        // Run inside a single transaction so wallet decrement + order insert
        // are atomic.
        const result = await this.prisma.$transaction(async (tx) => {
            const buyer = await tx.user.findUnique({
                where: { id: input.buyerId },
                select: { walletBalance: true }
            })
            if (!buyer) throw new GigNotPurchasableException(input.gigId, 'BuyerNotFound')
            if (buyer.walletBalance < gig.priceVnd) {
                throw new InsufficientWalletBalanceException(input.buyerId, gig.priceVnd, buyer.walletBalance)
            }

            const now = new Date()
            const acceptDeadline = new Date(now.getTime() + ACCEPT_WINDOW_MS)

            const order = await tx.order.create({
                data: {
                    buyerId: input.buyerId,
                    sellerId: gig.sellerId,
                    gigId: gig.id,
                    gigTitleSnapshot: gig.title,
                    gigPriceVndSnapshot: gig.priceVnd,
                    gigDeliveryDays: gig.deliveryDays,
                    gigCoverKey: gig.images[0]?.imageKey ?? null,
                    status: 'PendingReview',
                    placedAt: now,
                    acceptDeadline
                },
                include: this.orderIncludes
            })

            // Wallet escrow inside the same tx
            const payment = await this.walletRepo.moveToEscrow(input.buyerId, gig.priceVnd, order.id, tx)

            // Get or create the buyer/seller thread (idempotent — F08).
            const thread = await this.messagingRepo.createOrGetThread(input.buyerId, gig.sellerId)

            // Audit log + system event message — both in the same tx.
            await tx.orderEvent.create({
                data: {
                    orderId: order.id,
                    type: 'Placed',
                    actorUserId: input.buyerId,
                    payload: { number: order.number, priceVnd: gig.priceVnd }
                }
            })
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: order.id,
                type: 'order_placed',
                payload: {
                    number: order.number,
                    actorId: input.buyerId,
                    priceVnd: gig.priceVnd,
                    text: `${actorName(order.buyer)} placed ${formatOrderCode(order.number)}`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return {
                order: this.toOrderItem(order),
                refs: { paymentId: payment.id },
                _scheduleAcceptDeadline: {
                    orderId: order.id,
                    deadline: acceptDeadline
                }
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        // BullMQ enqueue lives OUTSIDE the $transaction so a job isn't queued
        // for a placement that ultimately rolled back. Trade-off: a crash
        // between tx commit and enqueue would lose the auto-cancel job. For
        // v1 the trade is acceptable — orders without a scheduled job stay
        // PendingReview until the buyer or admin notices and acts.
        await this.jobs.scheduleAcceptDeadline(
            result._scheduleAcceptDeadline.orderId,
            result._scheduleAcceptDeadline.deadline
        )

        return { order: result.order, refs: result.refs }
    }

    async acceptOrder(orderId: string, viewerId: string): Promise<OrderDetail> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) throw new OrderNotFoundException(orderId)
            if (order.sellerId !== viewerId) {
                throw new NotAParticipantException(orderId, viewerId)
            }
            if (order.status !== 'PendingReview') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'accept')
            }

            const now = new Date()
            const deliveryDeadline = new Date(now.getTime() + order.gigDeliveryDays * 24 * 60 * 60 * 1000)

            const updated = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'InProgress',
                    acceptedAt: now,
                    deliveryDeadline
                },
                include: this.orderIncludes
            })
            await tx.orderEvent.create({
                data: { orderId, type: 'Accepted', actorUserId: viewerId }
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'order_accepted',
                payload: {
                    number: order.number,
                    actorId: viewerId,
                    text: `${actorName(updated.seller)} accepted ${formatOrderCode(order.number)}`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return this.toOrderItem(updated)
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        // Remove the auto-cancel job — seller responded in time. (Phase-2
        // adds the DeliveryDeadlineJob schedule here too.)
        await this.jobs.removeAcceptDeadline(orderId)
        return result
    }

    async declineOrder(orderId: string, viewerId: string, note: string): Promise<OrderDetail> {
        const trimmed = note?.trim() ?? ''
        if (trimmed.length < 20) throw new DeclineNoteTooShortException(20)

        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) throw new OrderNotFoundException(orderId)
            if (order.sellerId !== viewerId) {
                throw new NotAParticipantException(orderId, viewerId)
            }
            if (order.status !== 'PendingReview') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'decline')
            }

            const now = new Date()
            const updated = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'Cancelled',
                    cancelledAt: now,
                    cancelledByUserId: viewerId,
                    cancellationReason: trimmed
                },
                include: this.orderIncludes
            })
            await this.walletRepo.refundFromEscrow(order.buyerId, order.gigPriceVndSnapshot, orderId, tx)
            await tx.orderEvent.create({
                data: {
                    orderId,
                    type: 'Declined',
                    actorUserId: viewerId,
                    payload: { note: trimmed }
                }
            })
            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'order_declined',
                payload: {
                    number: order.number,
                    actorId: viewerId,
                    note: trimmed,
                    text: `${actorName(updated.seller)} declined ${formatOrderCode(order.number)}`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return this.toOrderItem(updated)
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        // Seller is responding in time — kill the auto-cancel job.
        await this.jobs.removeAcceptDeadline(orderId)
        return result
    }

    async deliverWork(input: {
        orderId: string
        viewerId: string
        note: string
        stagedFileIds: string[]
    }): Promise<{ order: OrderDetail; delivery: DeliveryItem }> {
        // Note is optional — empty notes persist as empty strings, files do
        // most of the talking. The handler already trimmed; we just guard
        // for the no-payload case below.
        const trimmed = input.note?.trim() ?? ''

        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: input.orderId } })
            if (!order) throw new OrderNotFoundException(input.orderId)
            if (order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId, input.viewerId)
            }
            if (order.status !== 'InProgress' && order.status !== 'Late') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'deliver')
            }

            const now = new Date()
            const reviewDeadline = new Date(now.getTime() + REVIEW_WINDOW_MS)

            const delivery = await tx.delivery.create({
                data: {
                    orderId: input.orderId,
                    version: 1,
                    note: trimmed,
                    deliveredAt: now
                },
                include: { files: true }
            })

            // Claim staged files
            if (input.stagedFileIds.length > 0) {
                await tx.deliveryFile.updateMany({
                    where: {
                        id: { in: input.stagedFileIds },
                        deliveryId: null
                    },
                    data: { deliveryId: delivery.id }
                })
            }

            const updated = await tx.order.update({
                where: { id: input.orderId },
                data: {
                    status: 'Delivered',
                    deliveredAt: now,
                    reviewDeadline
                },
                include: {
                    ...this.orderIncludes,
                    deliveries: {
                        orderBy: { version: 'desc' as const },
                        include: { files: true }
                    }
                }
            })
            await tx.orderEvent.create({
                data: {
                    orderId: input.orderId,
                    type: 'Delivered',
                    actorUserId: input.viewerId,
                    payload: { deliveryId: delivery.id, version: 1 }
                }
            })
            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: input.orderId,
                type: 'order_delivered',
                payload: {
                    number: order.number,
                    actorId: input.viewerId,
                    deliveryId: delivery.id,
                    text: `${actorName(updated.seller)} delivered ${formatOrderCode(order.number)}`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            // Reload delivery with the now-claimed files for the return shape
            const fullDelivery = await tx.delivery.findUnique({
                where: { id: delivery.id },
                include: { files: true }
            })

            return {
                order: this.toOrderItem(updated),
                delivery: this.toDelivery(fullDelivery!)
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        return result
    }

    async acceptDelivery(orderId: string, viewerId: string): Promise<{ order: OrderDetail; refs: MoneyMoveRefs }> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) throw new OrderNotFoundException(orderId)
            if (order.buyerId !== viewerId) {
                throw new NotAParticipantException(orderId, viewerId)
            }
            if (order.status !== 'Delivered' && order.status !== 'AwaitingFinalization') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'accept-delivery')
            }

            const now = new Date()
            const updated = await tx.order.update({
                where: { id: orderId },
                data: { status: 'Completed', completedAt: now },
                include: this.orderIncludes
            })

            const { earning, platformFee } = await this.walletRepo.releaseFromEscrow(
                order.buyerId,
                order.sellerId,
                PLATFORM_FEE_COLLECTOR_USER_ID,
                order.gigPriceVndSnapshot,
                PLATFORM_FEE_PCT,
                orderId,
                tx
            )

            await tx.orderEvent.create({
                data: {
                    orderId,
                    type: 'AcceptDelivery',
                    actorUserId: viewerId,
                    payload: { earningId: earning.id, platformFeeId: platformFee.id }
                }
            })
            await tx.orderEvent.create({
                data: { orderId, type: 'Finalized', actorUserId: null }
            })
            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'order_completed',
                payload: {
                    number: order.number,
                    actorId: viewerId,
                    sellerShare: earning.amountVnd,
                    platformShare: platformFee.amountVnd,
                    text: `${actorName(updated.buyer)} accepted the delivery — ${formatOrderCode(order.number)} completed`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return {
                order: this.toOrderItem(updated),
                refs: { earningId: earning.id, platformFeeId: platformFee.id }
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        return result
    }

    async autoCancelOrder(orderId: string): Promise<OrderDetail | null> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) return null
            // Idempotent guard — the job may fire after the seller already
            // accepted or declined.
            if (order.status !== 'PendingReview') return null

            const now = new Date()
            const reason = "Seller didn't respond within 24 hours"
            const updated = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'Cancelled',
                    cancelledAt: now,
                    cancelledByUserId: null,
                    cancellationReason: reason
                },
                include: this.orderIncludes
            })
            await this.walletRepo.refundFromEscrow(order.buyerId, order.gigPriceVndSnapshot, orderId, tx)
            await tx.orderEvent.create({
                data: {
                    orderId,
                    type: 'AutoCancelled',
                    actorUserId: null,
                    payload: { reason }
                }
            })
            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'order_auto_cancelled',
                payload: {
                    number: order.number,
                    reason,
                    text: `${formatOrderCode(order.number)} auto-cancelled — seller didn't respond in 24h`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return this.toOrderItem(updated)
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        return result
    }

    async updateDelivery(input: {
        orderId: string
        viewerId: string
        note: string
        stagedFileIds: string[]
    }): Promise<{ order: OrderDetail; delivery: DeliveryItem }> {
        // Note is optional — same rule as deliverWork. The "update" lets the
        // seller iterate on the delivered files before the buyer accepts.
        const trimmed = input.note?.trim() ?? ''

        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: input.orderId } })
            if (!order) throw new OrderNotFoundException(input.orderId)
            if (order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId, input.viewerId)
            }
            // Only updatable while the buyer hasn't accepted yet. Once the
            // order Completes or Cancels the delivery history is frozen.
            if (order.status !== 'Delivered' && order.status !== 'AwaitingFinalization') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'deliver')
            }

            // Compute the next version number from the existing rows. We
            // could rely on a unique (orderId, version) constraint instead,
            // but reading the max is one query and keeps the schema migration
            // unchanged.
            const latest = await tx.delivery.findFirst({
                where: { orderId: input.orderId },
                orderBy: { version: 'desc' as const },
                select: { version: true }
            })
            const nextVersion = (latest?.version ?? 0) + 1

            const now = new Date()
            const delivery = await tx.delivery.create({
                data: {
                    orderId: input.orderId,
                    version: nextVersion,
                    note: trimmed,
                    deliveredAt: now
                },
                include: { files: true }
            })

            // Claim staged files — same as deliverWork.
            if (input.stagedFileIds.length > 0) {
                await tx.deliveryFile.updateMany({
                    where: {
                        id: { in: input.stagedFileIds },
                        deliveryId: null
                    },
                    data: { deliveryId: delivery.id }
                })
            }

            // Anti-gaming rule (SRS §Delivery Updates & Versioning): the
            // auto-complete countdown does NOT reset on update. We do NOT
            // touch order.status, order.deliveredAt, or order.reviewDeadline
            // — they reflect v1's timestamps. The buyer's review clock keeps
            // ticking against the original delivery.
            const updated = await tx.order.update({
                where: { id: input.orderId },
                data: {}, // no-op write, just to refetch with includes
                include: {
                    ...this.orderIncludes,
                    deliveries: {
                        orderBy: { version: 'desc' as const },
                        include: { files: true }
                    }
                }
            })

            await tx.orderEvent.create({
                data: {
                    orderId: input.orderId,
                    type: 'DeliveryUpdated',
                    actorUserId: input.viewerId,
                    payload: { deliveryId: delivery.id, version: nextVersion }
                }
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: input.orderId,
                type: 'order_delivery_updated',
                payload: {
                    number: order.number,
                    actorId: input.viewerId,
                    deliveryId: delivery.id,
                    version: nextVersion,
                    text: `${actorName(updated.seller)} updated ${formatOrderCode(order.number)} delivery (v${nextVersion})`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            const fullDelivery = await tx.delivery.findUnique({
                where: { id: delivery.id },
                include: { files: true }
            })

            return {
                order: this.toOrderItem(updated),
                delivery: this.toDelivery(fullDelivery!)
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        return result
    }

    // ── Phase 2 stubs (return rejection until Phase 2 lands) ───────────────

    requestExtension(): never {
        throw new Error('requestExtension is Phase 2 — not yet implemented')
    }
    decideExtension(): never {
        throw new Error('decideExtension is Phase 2 — not yet implemented')
    }
    requestCancellation(): never {
        throw new Error('requestCancellation is Phase 2 — not yet implemented')
    }
    decideCancellation(): never {
        throw new Error('decideCancellation is Phase 2 — not yet implemented')
    }
    markLate(): never {
        throw new Error('markLate is Phase 2 — not yet implemented')
    }
    autoCompleteOrder(): never {
        throw new Error('autoCompleteOrder is Phase 2 — not yet implemented')
    }
    finalizeOrder(): never {
        throw new Error('finalizeOrder is Phase 2 — not yet implemented')
    }
    expireExtension(): never {
        throw new Error('expireExtension is Phase 2 — not yet implemented')
    }
    expireCancellation(): never {
        throw new Error('expireCancellation is Phase 2 — not yet implemented')
    }
}

function numericLike(s: string): boolean {
    return /^\d{1,9}$/.test(s)
}

function sortToOrderBy(sort: OrdersSort) {
    switch (sort) {
        case 'newest':
            return [{ placedAt: 'desc' as const }]
        case 'oldest':
            return [{ placedAt: 'asc' as const }]
        case 'amount_desc':
            return [{ gigPriceVndSnapshot: 'desc' as const }]
        case 'amount_asc':
            return [{ gigPriceVndSnapshot: 'asc' as const }]
        case 'most_urgent':
        default:
            // Server-side "most urgent" is approximated as soonest deadline first.
            // The actionRequired-first sort would need a custom SQL CASE; for
            // Phase 1 just sort by placedAt desc (urgent rows naturally cluster
            // near the top within the loaded window). Real urgency sort is a
            // Phase-2 polish task.
            return [{ placedAt: 'desc' as const }]
    }
}

// Reference variables used downstream — silence unused linter when relevant
void EXTENSION_WINDOW_MS
void CANCELLATION_WINDOW_MS
void DISPUTE_WINDOW_MS
