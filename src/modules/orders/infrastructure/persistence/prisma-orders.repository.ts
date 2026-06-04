import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'
import { formatOrderCode } from '@/shared/utils'
import { PLATFORM_FEE_COLLECTOR_USER_ID } from '@/shared/constants/platform'
import { MESSAGING_REPOSITORY_PORT, MessageItem, MessagingRepositoryPort } from '@/modules/messaging/domain/ports'
import { SocketEmitter } from '@/modules/messaging/application/events/handlers'
import { WALLET_REPOSITORY_PORT, WalletRepositoryPort } from '@/modules/wallet/domain/ports/wallet.repository.port'

import {
    CancellationItem,
    CancellationReasonCode,
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
    PendingCancellationAlreadyExistsException,
    PendingExtensionAlreadyExistsException,
    SellerCannotOrderOwnGigException
} from '../../domain/exceptions'
import { OrderJobsScheduler } from '../jobs/order-jobs.scheduler'
import {
    computeDisputePayout,
    DisputeParty,
    DisputeReasonCode,
    DisputeVerdict,
    OrderDisputeInfo
} from '@/modules/disputes/domain'

const PLATFORM_FEE_PCT = 20

function actorName(user: { displayName: string | null; username: string | null } | null | undefined): string {
    if (!user) return 'User'
    const dn = user.displayName?.trim()
    if (dn) return dn
    return user.username ?? 'User'
}

const ACCEPT_WINDOW_MS = 24 * 60 * 60 * 1000
const REVIEW_WINDOW_MS = 72 * 60 * 60 * 1000
const DISPUTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const EXTENSION_WINDOW_MS = 24 * 60 * 60 * 1000
const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000

const CANCELLATION_REASON_LABELS: Record<CancellationReasonCode, string> = {
    BuyerSituationChanged: 'My situation changed — I no longer need this',
    BuyerOrderedByMistake: 'Ordered by mistake',
    BuyerAgreedInChat: 'We agreed to cancel in chat',
    BuyerOther: 'Other',
    SellerScheduleConflict: "Schedule conflict — can't deliver in time",
    SellerRequirementsMismatch: 'Requirements turned out to be different than expected',
    SellerAgreedInChat: 'We agreed to cancel in chat',
    SellerOther: 'Other'
}

function formatCancellationReason(code: CancellationReasonCode, otherText: string | null): string {
    const label = CANCELLATION_REASON_LABELS[code]
    return otherText ? `${label} — ${otherText}` : label
}

@Injectable()
export class PrismaOrdersRepository implements OrdersRepositoryPort {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(WALLET_REPOSITORY_PORT)
        private readonly walletRepo: WalletRepositoryPort,
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly messagingRepo: MessagingRepositoryPort,
        private readonly jobs: OrderJobsScheduler,
        // Emit AFTER $transaction commits so rollbacks don't publish phantom messages.
        private readonly socketEmitter: SocketEmitter
    ) {}

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
            deliveryCount: (o.deliveries ?? []).length,
            review: o.review
                ? {
                      id: o.review.id,
                      rating: o.review.ratingHalfStars / 2,
                      body: o.review.body,
                      replyBody: o.review.replyBody ?? null,
                      repliedAt: o.review.repliedAt ?? null,
                      createdAt: o.review.createdAt
                  }
                : null,
            dispute: o.dispute ? this.toDisputeInfo(o.dispute, o.gigPriceVndSnapshot) : null
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toDisputeInfo(d: any, priceVnd: number): OrderDisputeInfo {
        const filerRole = d.filedByRole as DisputeParty
        const opposite: DisputeParty = filerRole === 'Buyer' ? 'Seller' : 'Buyer'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapEvidence = (rows: any[], side: DisputeParty) =>
            rows
                .filter((e) => e.side === side)
                .map((e) => ({
                    id: e.id,
                    side: e.side as DisputeParty,
                    name: e.name,
                    size: e.size,
                    mime: e.mime,
                    createdAt: e.createdAt
                }))
        const evidence = d.evidence ?? []
        return {
            status: d.status,
            filedByRole: filerRole,
            reasonCode: d.reasonCode as DisputeReasonCode,
            filerStatement: d.filerStatement,
            filerEvidence: mapEvidence(evidence, filerRole),
            responderStatement: d.responderStatement ?? null,
            responderEvidence: mapEvidence(evidence, opposite),
            filedAt: d.filedAt,
            respondedAt: d.respondedAt ?? null,
            responseDeadline: d.responseDeadline,
            verdict: d.verdict ?? null,
            buyerRefundPercent: d.buyerRefundPercent ?? null,
            adminNotes: d.adminNotes ?? null,
            resolvedAt: d.resolvedAt ?? null,
            payout:
                d.verdict != null
                    ? computeDisputePayout(priceVnd, d.verdict as DisputeVerdict, d.buyerRefundPercent)
                    : null
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
            hoursRequested: e.hoursRequested,
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
            },
            review: true,
            dispute: { include: { evidence: { orderBy: { createdAt: 'asc' as const } } } }
        }
    }

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
                },
                dispute: { select: { filedByUserId: true, status: true } }
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
                    buyerId: o.buyerId,
                    disputeFiledById: o.dispute?.filedByUserId ?? null,
                    disputeStatus: o.dispute?.status ?? null
                })
            }
        })

        // Filter post-map because actionRequired depends on the viewer-role join.
        const filtered = input.actionRequiredOnly === true ? items.filter((r) => r.actionRequired) : items

        return {
            items: filtered,
            total: counts.all,
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
        disputeFiledById?: string | null
        disputeStatus?: string | null
    }): boolean {
        // Viewer is next-mover OR is the decider on a pending request from the other party.
        if (args.status === 'PendingReview' && args.side === 'seller') return true
        if (args.status === 'Delivered' && args.side === 'buyer') return true
        if (args.status === 'AwaitingFinalization' && args.side === 'buyer') return true
        if (args.status === 'Late' && args.side === 'buyer') return true
        if (args.pendingExt && args.side === 'buyer') return true
        if (args.pendingCancel) {
            // Decider = whoever didn't request.
            if (args.pendingCancelInitiator === 'Buyer' && args.side === 'seller') return true
            if (args.pendingCancelInitiator === 'Seller' && args.side === 'buyer') return true
        }
        // Frozen + the responder (counterparty who didn't file) owes a 48h response.
        if (
            args.status === 'Frozen' &&
            args.disputeStatus === 'AwaitingResponse' &&
            args.disputeFiledById != null &&
            args.viewerId !== args.disputeFiledById
        ) {
            return true
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
        // Load candidate rows, filter in JS — counts are small at campus scale.
        // Rules mirror computeActionRequired.
        const [asBuyerRows, asSellerRows] = await Promise.all([
            this.prisma.order.findMany({
                where: {
                    buyerId: viewerId,
                    status: {
                        in: ['Delivered', 'InProgress', 'Late', 'AwaitingFinalization', 'Frozen']
                    }
                },
                include: {
                    extensions: { where: { status: 'Pending' }, take: 1 },
                    cancellations: { where: { status: 'Pending' }, take: 1 },
                    dispute: { select: { filedByUserId: true, status: true } }
                }
            }),
            this.prisma.order.findMany({
                where: {
                    sellerId: viewerId,
                    status: { in: ['PendingReview', 'InProgress', 'Late', 'Delivered', 'Frozen'] }
                },
                include: {
                    extensions: { where: { status: 'Pending' }, take: 1 },
                    cancellations: { where: { status: 'Pending' }, take: 1 },
                    dispute: { select: { filedByUserId: true, status: true } }
                }
            })
        ])

        // Responder owes a 48h response on a frozen order they didn't file.
        const owesDisputeResponse = (o: {
            status: string
            dispute: { filedByUserId: string; status: string } | null
        }) => o.status === 'Frozen' && o.dispute?.status === 'AwaitingResponse' && o.dispute.filedByUserId !== viewerId

        const asBuyer = asBuyerRows.filter((o) => {
            if (o.status === 'Delivered') return true
            if (o.status === 'AwaitingFinalization') return true
            if (o.status === 'Late') return true
            if (o.extensions.length > 0) return true
            if (o.cancellations.length > 0 && o.cancellations[0].initiator === 'Seller') return true
            if (owesDisputeResponse(o)) return true
            return false
        }).length
        const asSeller = asSellerRows.filter((o) => {
            if (o.status === 'PendingReview') return true
            if (o.cancellations.length > 0 && o.cancellations[0].initiator === 'Buyer') return true
            if (owesDisputeResponse(o)) return true
            return false
        }).length

        return { asBuyer, asSeller }
    }

    async listActiveBetween(viewerId: string, otherUserId: string): Promise<OrderListRow[]> {
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

    // All transitions wrap wallet ops + system message inserts in one $transaction
    // with a status guard so state, money, and audit log commit atomically.

    async placeOrder(input: {
        buyerId: string
        gigId: string
        idempotencyKey: string
    }): Promise<{ order: OrderDetail; refs: MoneyMoveRefs }> {
        // Pre-flight reads outside the tx; balance is re-checked inside as the authoritative guard.
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

        // Captured inside the tx, emitted after commit so a rollback doesn't publish a phantom.
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null

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

            const payment = await this.walletRepo.moveToEscrow(input.buyerId, gig.priceVnd, order.id, tx)

            const thread = await this.messagingRepo.createOrGetThread(input.buyerId, gig.sellerId)

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

        // Enqueue outside the tx so a rolled-back placement doesn't schedule a job.
        // Trade-off: a crash between commit and enqueue loses the auto-cancel job.
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

        await this.jobs.removeAcceptDeadline(orderId)
        if (result.deliveryDeadline) {
            await this.jobs.scheduleDeliveryDeadline(orderId, result.deliveryDeadline)
        }
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

        await this.jobs.removeAcceptDeadline(orderId)
        return result
    }

    async deliverWork(input: {
        orderId: string
        viewerId: string
        note: string
        stagedFileIds: string[]
    }): Promise<{ order: OrderDetail; delivery: DeliveryItem }> {
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

        await this.jobs.removeDeliveryDeadline(input.orderId)
        if (result.order.reviewDeadline) {
            await this.jobs.scheduleReviewDeadline(input.orderId, result.order.reviewDeadline)
        }

        return result
    }

    async acceptDelivery(orderId: string, viewerId: string): Promise<{ order: OrderDetail; refs: MoneyMoveRefs }> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            // Serialize concurrent transitions on this order (buyer accept racing the
            // auto-finalize/auto-complete jobs) so escrow is released exactly once.
            await tx.$queryRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`
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
            await tx.gig.update({ where: { id: order.gigId }, data: { completedOrderCount: { increment: 1 } } })

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

        // Kill both possible pending jobs — order could be Delivered (review) or AwaitingFinalization (dispute).
        await this.jobs.removeReviewDeadline(orderId)
        await this.jobs.removeDisputeDeadline(orderId)

        return result
    }

    async autoCancelOrder(orderId: string): Promise<OrderDetail | null> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) return null
            // Idempotent — job may fire after seller already decided.
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
        const trimmed = input.note?.trim() ?? ''

        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: input.orderId } })
            if (!order) throw new OrderNotFoundException(input.orderId)
            if (order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId, input.viewerId)
            }
            if (order.status !== 'Delivered' && order.status !== 'AwaitingFinalization') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'deliver')
            }

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

            if (input.stagedFileIds.length > 0) {
                await tx.deliveryFile.updateMany({
                    where: {
                        id: { in: input.stagedFileIds },
                        deliveryId: null
                    },
                    data: { deliveryId: delivery.id }
                })
            }

            // Anti-gaming: auto-complete countdown does NOT reset on update.
            // Do NOT touch order.status / deliveredAt / reviewDeadline — they stay on v1's timestamps.
            const updated = await tx.order.update({
                where: { id: input.orderId },
                data: {}, // no-op, just to refetch with includes
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

    async requestExtension(input: {
        orderId: string
        viewerId: string
        hoursRequested: number
        reason: string | null
    }): Promise<{ order: OrderDetail; extension: ExtensionItem }> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        let pendingExpiry: { extensionId: string; expiresAt: Date } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: input.orderId } })
            if (!order) throw new OrderNotFoundException(input.orderId)
            if (order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId, input.viewerId)
            }
            // InProgress extends deliveryDeadline; Delivered extends reviewDeadline.
            // Late is blocked (deadline already missed — must deliver instead).
            if (order.status !== 'InProgress' && order.status !== 'Delivered') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'request-extension')
            }
            const existing = await tx.extension.findFirst({
                where: { orderId: input.orderId, status: 'Pending' as const },
                select: { id: true }
            })
            if (existing) throw new PendingExtensionAlreadyExistsException(input.orderId)

            const now = new Date()
            const expiresAt = new Date(now.getTime() + EXTENSION_WINDOW_MS)

            const ext = await tx.extension.create({
                data: {
                    orderId: input.orderId,
                    requestedById: input.viewerId,
                    hoursRequested: input.hoursRequested,
                    reason: input.reason,
                    status: 'Pending',
                    requestedAt: now,
                    expiresAt
                }
            })

            await tx.orderEvent.create({
                data: {
                    orderId: input.orderId,
                    type: 'ExtensionRequested',
                    actorUserId: input.viewerId,
                    payload: {
                        extensionId: ext.id,
                        hoursRequested: input.hoursRequested,
                        reason: input.reason
                    }
                }
            })

            const reloaded = await tx.order.findUnique({
                where: { id: input.orderId },
                include: this.orderIncludes
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: input.orderId,
                type: 'extension_requested',
                payload: {
                    number: order.number,
                    actorId: input.viewerId,
                    extensionId: ext.id,
                    hoursRequested: input.hoursRequested,
                    text: `${actorName(reloaded!.seller)} requested +${input.hoursRequested}h extension on ${formatOrderCode(order.number)}`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }
            pendingExpiry = { extensionId: ext.id, expiresAt }

            return {
                order: this.toOrderItem(reloaded!),
                extension: this.toExtension(ext)
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }
        if (pendingExpiry) {
            const { extensionId, expiresAt } = pendingExpiry as {
                extensionId: string
                expiresAt: Date
            }
            await this.jobs.scheduleExtensionExpiry(extensionId, expiresAt)
        }

        return result
    }

    async decideExtension(input: {
        extensionId: string
        viewerId: string
        decision: 'accept' | 'reject'
    }): Promise<{ order: OrderDetail; extension: ExtensionItem }> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        let pendingReschedule: { kind: 'delivery' | 'review'; orderId: string; deadline: Date } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            const ext = await tx.extension.findUnique({
                where: { id: input.extensionId },
                include: { order: true }
            })
            if (!ext || !ext.order) throw new OrderNotFoundException(input.extensionId)
            if (ext.status !== 'Pending') {
                throw new InvalidTransitionException(ext.order.status as OrderStatus, 'decide-extension')
            }
            // Buyer decides; seller requested.
            if (ext.order.buyerId !== input.viewerId) {
                throw new NotAParticipantException(ext.orderId, input.viewerId)
            }

            const now = new Date()
            const newStatus = input.decision === 'accept' ? 'Accepted' : 'Rejected'

            // On accept, shift the live deadline: InProgress/Late → deliveryDeadline, Delivered → reviewDeadline.
            // Late flips back to InProgress when the shifted deliveryDeadline is in the future.
            const orderUpdateData: {
                status?: OrderStatus
                deliveryDeadline?: Date
                reviewDeadline?: Date
            } = {}
            if (input.decision === 'accept') {
                const hoursMs = ext.hoursRequested * 60 * 60 * 1000
                if (ext.order.status === 'InProgress' || ext.order.status === 'Late') {
                    const base = ext.order.deliveryDeadline ?? now
                    const newDeadline = new Date(base.getTime() + hoursMs)
                    orderUpdateData.deliveryDeadline = newDeadline
                    if (ext.order.status === 'Late' && newDeadline.getTime() > now.getTime()) {
                        orderUpdateData.status = 'InProgress'
                    }
                    pendingReschedule = {
                        kind: 'delivery',
                        orderId: ext.orderId,
                        deadline: newDeadline
                    }
                } else if (ext.order.status === 'Delivered') {
                    const base = ext.order.reviewDeadline ?? now
                    const newDeadline = new Date(base.getTime() + hoursMs)
                    orderUpdateData.reviewDeadline = newDeadline
                    pendingReschedule = {
                        kind: 'review',
                        orderId: ext.orderId,
                        deadline: newDeadline
                    }
                }
            }

            const updatedExt = await tx.extension.update({
                where: { id: input.extensionId },
                data: {
                    status: newStatus,
                    decidedAt: now,
                    decidedById: input.viewerId
                }
            })

            if (Object.keys(orderUpdateData).length > 0) {
                await tx.order.update({
                    where: { id: ext.orderId },
                    data: orderUpdateData
                })
            }

            await tx.orderEvent.create({
                data: {
                    orderId: ext.orderId,
                    type: input.decision === 'accept' ? 'ExtensionAccepted' : 'ExtensionRejected',
                    actorUserId: input.viewerId,
                    payload: { extensionId: ext.id }
                }
            })

            const reloaded = await tx.order.findUnique({
                where: { id: ext.orderId },
                include: this.orderIncludes
            })

            const thread = await this.messagingRepo.createOrGetThread(ext.order.buyerId, ext.order.sellerId)
            const text =
                input.decision === 'accept'
                    ? `${actorName(reloaded!.buyer)} accepted the extension on ${formatOrderCode(ext.order.number)}`
                    : `${actorName(reloaded!.buyer)} declined the extension on ${formatOrderCode(ext.order.number)}`
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: ext.orderId,
                type: input.decision === 'accept' ? 'extension_accepted' : 'extension_rejected',
                payload: {
                    number: ext.order.number,
                    actorId: input.viewerId,
                    extensionId: ext.id,
                    text
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return {
                order: this.toOrderItem(reloaded!),
                extension: this.toExtension(updatedExt)
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        await this.jobs.removeExtensionExpiry(input.extensionId)

        if (pendingReschedule) {
            const { kind, orderId, deadline } = pendingReschedule as {
                kind: 'delivery' | 'review'
                orderId: string
                deadline: Date
            }
            if (kind === 'delivery') {
                await this.jobs.removeDeliveryDeadline(orderId)
                await this.jobs.scheduleDeliveryDeadline(orderId, deadline)
            } else {
                await this.jobs.removeReviewDeadline(orderId)
                await this.jobs.scheduleReviewDeadline(orderId, deadline)
            }
        }

        return result
    }

    async expireExtension(extensionId: string): Promise<{ order: OrderDetail; extension: ExtensionItem } | null> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            const ext = await tx.extension.findUnique({
                where: { id: extensionId },
                include: { order: true }
            })
            // Idempotent — job may fire after buyer already decided.
            if (!ext || ext.status !== 'Pending') return null

            const now = new Date()
            const updated = await tx.extension.update({
                where: { id: extensionId },
                data: { status: 'Expired', decidedAt: now }
            })
            await tx.orderEvent.create({
                data: {
                    orderId: ext.orderId,
                    type: 'ExtensionExpired',
                    actorUserId: null,
                    payload: { extensionId }
                }
            })

            const thread = await this.messagingRepo.createOrGetThread(ext.order.buyerId, ext.order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: ext.orderId,
                type: 'extension_expired',
                payload: {
                    number: ext.order.number,
                    extensionId,
                    text: `Extension request on ${formatOrderCode(ext.order.number)} expired`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            const reloaded = await tx.order.findUnique({
                where: { id: ext.orderId },
                include: this.orderIncludes
            })

            return {
                order: this.toOrderItem(reloaded!),
                extension: this.toExtension(updated)
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

    async requestCancellation(input: {
        orderId: string
        viewerId: string
        reasonCode: CancellationReasonCode
        otherText: string | null
    }): Promise<{ order: OrderDetail; cancellation: CancellationItem }> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        let pendingExpiry: { cancellationId: string; expiresAt: Date } | null = null
        // Fast-cancel: buyer + PendingReview → flip to Cancelled in-tx, no 24h window.
        let didFastCancel = false

        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: input.orderId } })
            if (!order) throw new OrderNotFoundException(input.orderId)
            if (order.buyerId !== input.viewerId && order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId, input.viewerId)
            }
            // Terminal + Frozen states are blocked; all live states are allowed.
            if (order.status === 'Completed' || order.status === 'Cancelled' || order.status === 'Frozen') {
                throw new InvalidTransitionException(order.status as OrderStatus, 'request-cancellation')
            }
            const existing = await tx.cancellation.findFirst({
                where: { orderId: input.orderId, status: 'Pending' as const },
                select: { id: true }
            })
            if (existing) throw new PendingCancellationAlreadyExistsException(input.orderId)

            // Validate reasonCode prefix matches initiator role.
            const initiator: 'Buyer' | 'Seller' = order.buyerId === input.viewerId ? 'Buyer' : 'Seller'
            const codeIsBuyer = input.reasonCode.startsWith('Buyer')
            const codeIsSeller = input.reasonCode.startsWith('Seller')
            if ((initiator === 'Buyer' && !codeIsBuyer) || (initiator === 'Seller' && !codeIsSeller)) {
                throw new InvalidTransitionException(
                    order.status as OrderStatus,
                    `request-cancellation:role-mismatch(${input.reasonCode})`
                )
            }

            const now = new Date()
            const friendlyReason = formatCancellationReason(input.reasonCode, input.otherText)

            // Buyer fast-cancel: PendingReview + Buyer initiator → immediate refund + close.
            if (order.status === 'PendingReview' && initiator === 'Buyer') {
                const cancel = await tx.cancellation.create({
                    data: {
                        orderId: input.orderId,
                        requestedById: input.viewerId,
                        initiator,
                        reasonCode: input.reasonCode,
                        otherText: input.otherText,
                        status: 'Accepted',
                        requestedAt: now,
                        // expiresAt is required by schema; already decided, so set to now.
                        expiresAt: now,
                        decidedAt: now,
                        decidedById: input.viewerId
                    }
                })

                await this.walletRepo.refundFromEscrow(order.buyerId, order.gigPriceVndSnapshot, input.orderId, tx)

                await tx.order.update({
                    where: { id: input.orderId },
                    data: {
                        status: 'Cancelled',
                        cancelledAt: now,
                        cancelledByUserId: input.viewerId,
                        cancellationReason: friendlyReason
                    }
                })

                await tx.orderEvent.create({
                    data: {
                        orderId: input.orderId,
                        type: 'CancellationRequested',
                        actorUserId: input.viewerId,
                        payload: {
                            cancellationId: cancel.id,
                            initiator,
                            reasonCode: input.reasonCode,
                            otherText: input.otherText,
                            fastCancel: true
                        }
                    }
                })
                await tx.orderEvent.create({
                    data: {
                        orderId: input.orderId,
                        type: 'CancellationAccepted',
                        actorUserId: input.viewerId,
                        payload: { cancellationId: cancel.id, fastCancel: true }
                    }
                })

                const reloaded = await tx.order.findUnique({
                    where: { id: input.orderId },
                    include: this.orderIncludes
                })

                const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
                const sysMsg = await this.messagingRepo.insertSystemEvent({
                    threadId: thread.id,
                    orderId: input.orderId,
                    type: 'cancellation_accepted',
                    payload: {
                        number: order.number,
                        actorId: input.viewerId,
                        cancellationId: cancel.id,
                        fastCancel: true,
                        text: `${actorName(reloaded!.buyer)} cancelled ${formatOrderCode(order.number)} — order closed and refunded`
                    },
                    at: now,
                    tx
                })
                pendingSysEvent = { threadId: thread.id, message: sysMsg }
                didFastCancel = true

                return {
                    order: this.toOrderItem(reloaded!),
                    cancellation: this.toCancellation(cancel)
                }
            }

            // Standard path: insert Pending row + schedule 24h expiry; order stays in current state.
            const expiresAt = new Date(now.getTime() + CANCELLATION_WINDOW_MS)

            const cancel = await tx.cancellation.create({
                data: {
                    orderId: input.orderId,
                    requestedById: input.viewerId,
                    initiator,
                    reasonCode: input.reasonCode,
                    otherText: input.otherText,
                    status: 'Pending',
                    requestedAt: now,
                    expiresAt
                }
            })

            await tx.orderEvent.create({
                data: {
                    orderId: input.orderId,
                    type: 'CancellationRequested',
                    actorUserId: input.viewerId,
                    payload: {
                        cancellationId: cancel.id,
                        initiator,
                        reasonCode: input.reasonCode,
                        otherText: input.otherText
                    }
                }
            })

            const reloaded = await tx.order.findUnique({
                where: { id: input.orderId },
                include: this.orderIncludes
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const actorParty = initiator === 'Buyer' ? reloaded!.buyer : reloaded!.seller
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: input.orderId,
                type: 'cancellation_requested',
                payload: {
                    number: order.number,
                    actorId: input.viewerId,
                    cancellationId: cancel.id,
                    initiator,
                    reasonCode: input.reasonCode,
                    text: `${actorName(actorParty)} requested to cancel ${formatOrderCode(order.number)}`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }
            pendingExpiry = { cancellationId: cancel.id, expiresAt }

            return {
                order: this.toOrderItem(reloaded!),
                cancellation: this.toCancellation(cancel)
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }
        // Fast-cancel skipped the accept-deadline window — drop the stale job.
        if (didFastCancel) {
            await this.jobs.removeAcceptDeadline(input.orderId)
        }
        if (pendingExpiry) {
            const { cancellationId, expiresAt } = pendingExpiry as {
                cancellationId: string
                expiresAt: Date
            }
            await this.jobs.scheduleCancellationExpiry(cancellationId, expiresAt)
        }

        return result
    }

    async decideCancellation(input: {
        cancellationId: string
        viewerId: string
        decision: 'accept' | 'reject'
    }): Promise<{ order: OrderDetail; cancellation: CancellationItem; refs: MoneyMoveRefs }> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        let refundId: string | undefined

        const result = await this.prisma.$transaction(async (tx) => {
            const cancel = await tx.cancellation.findUnique({
                where: { id: input.cancellationId },
                include: { order: true }
            })
            if (!cancel || !cancel.order) throw new OrderNotFoundException(input.cancellationId)
            if (cancel.status !== 'Pending') {
                throw new InvalidTransitionException(cancel.order.status as OrderStatus, 'decide-cancellation')
            }
            // Decider = counterparty, not the requester.
            const isParticipant = cancel.order.buyerId === input.viewerId || cancel.order.sellerId === input.viewerId
            if (!isParticipant) {
                throw new NotAParticipantException(cancel.orderId, input.viewerId)
            }
            if (cancel.requestedById === input.viewerId) {
                throw new NotAParticipantException(cancel.orderId, input.viewerId)
            }

            const now = new Date()
            const newCancelStatus = input.decision === 'accept' ? 'Accepted' : 'Rejected'

            const updatedCancel = await tx.cancellation.update({
                where: { id: input.cancellationId },
                data: {
                    status: newCancelStatus,
                    decidedAt: now,
                    decidedById: input.viewerId
                }
            })

            if (input.decision === 'accept') {
                const refund = await this.walletRepo.refundFromEscrow(
                    cancel.order.buyerId,
                    cancel.order.gigPriceVndSnapshot,
                    cancel.orderId,
                    tx
                )
                refundId = refund.id
                await tx.order.update({
                    where: { id: cancel.orderId },
                    data: {
                        status: 'Cancelled',
                        cancelledAt: now,
                        cancelledByUserId: input.viewerId,
                        cancellationReason: formatCancellationReason(
                            cancel.reasonCode as CancellationReasonCode,
                            cancel.otherText
                        )
                    }
                })
            }

            await tx.orderEvent.create({
                data: {
                    orderId: cancel.orderId,
                    type: input.decision === 'accept' ? 'CancellationAccepted' : 'CancellationRejected',
                    actorUserId: input.viewerId,
                    payload: { cancellationId: cancel.id }
                }
            })

            const reloaded = await tx.order.findUnique({
                where: { id: cancel.orderId },
                include: this.orderIncludes
            })

            const thread = await this.messagingRepo.createOrGetThread(cancel.order.buyerId, cancel.order.sellerId)
            const deciderParty = cancel.order.buyerId === input.viewerId ? reloaded!.buyer : reloaded!.seller
            const text =
                input.decision === 'accept'
                    ? `${actorName(deciderParty)} accepted the cancellation — ${formatOrderCode(cancel.order.number)} cancelled`
                    : `${actorName(deciderParty)} declined the cancellation request on ${formatOrderCode(cancel.order.number)}`
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: cancel.orderId,
                type: input.decision === 'accept' ? 'cancellation_accepted' : 'cancellation_rejected',
                payload: {
                    number: cancel.order.number,
                    actorId: input.viewerId,
                    cancellationId: cancel.id,
                    text
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return {
                order: this.toOrderItem(reloaded!),
                cancellation: this.toCancellation(updatedCancel),
                refs: refundId ? { refundId } : {}
            }
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }

        await this.jobs.removeCancellationExpiry(input.cancellationId)
        // Accept = terminal — kill all remaining deadline jobs.
        if (input.decision === 'accept') {
            await this.jobs.removeAcceptDeadline(result.order.id)
            await this.jobs.removeDeliveryDeadline(result.order.id)
            await this.jobs.removeReviewDeadline(result.order.id)
            await this.jobs.removeDisputeDeadline(result.order.id)
        }

        return result
    }

    async expireCancellation(
        cancellationId: string
    ): Promise<{ order: OrderDetail; cancellation: CancellationItem } | null> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            const cancel = await tx.cancellation.findUnique({
                where: { id: cancellationId },
                include: { order: true }
            })
            if (!cancel || cancel.status !== 'Pending') return null

            const now = new Date()
            const updated = await tx.cancellation.update({
                where: { id: cancellationId },
                data: { status: 'Expired', decidedAt: now }
            })
            await tx.orderEvent.create({
                data: {
                    orderId: cancel.orderId,
                    type: 'CancellationExpired',
                    actorUserId: null,
                    payload: { cancellationId }
                }
            })

            const thread = await this.messagingRepo.createOrGetThread(cancel.order.buyerId, cancel.order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: cancel.orderId,
                type: 'cancellation_expired',
                payload: {
                    number: cancel.order.number,
                    cancellationId,
                    text: `Cancellation request on ${formatOrderCode(cancel.order.number)} expired`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            const reloaded = await tx.order.findUnique({
                where: { id: cancel.orderId },
                include: this.orderIncludes
            })

            return {
                order: this.toOrderItem(reloaded!),
                cancellation: this.toCancellation(updated)
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

    async markLate(orderId: string): Promise<OrderDetail | null> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) return null
            // Idempotent — seller may have delivered just in time.
            if (order.status !== 'InProgress') return null

            const now = new Date()
            const updated = await tx.order.update({
                where: { id: orderId },
                data: { status: 'Late' },
                include: this.orderIncludes
            })
            await tx.orderEvent.create({
                data: { orderId, type: 'Late', actorUserId: null }
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'order_marked_late',
                payload: {
                    number: order.number,
                    text: `${formatOrderCode(order.number)} marked late — delivery deadline passed`
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

    async autoCompleteOrder(orderId: string): Promise<OrderDetail | null> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null
        let pendingDispute: { orderId: string; deadline: Date } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            // Row lock — see acceptDelivery; serializes against a concurrent buyer accept.
            await tx.$queryRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) return null
            // Idempotent — buyer may have accepted in the last second.
            if (order.status !== 'Delivered') return null

            const now = new Date()
            const disputeDeadline = new Date(now.getTime() + DISPUTE_WINDOW_MS)

            const updated = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'AwaitingFinalization',
                    autoCompletedAt: now,
                    disputeDeadline
                },
                include: this.orderIncludes
            })
            await tx.orderEvent.create({
                data: { orderId, type: 'AutoCompleted', actorUserId: null }
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'order_auto_completed',
                payload: {
                    number: order.number,
                    text: `${formatOrderCode(order.number)} auto-completed — dispute window started`
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }
            pendingDispute = { orderId, deadline: disputeDeadline }

            return this.toOrderItem(updated)
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as {
                threadId: string
                message: MessageItem
            }
            this.emitSystemEventMessage(threadId, message)
        }
        if (pendingDispute) {
            const { orderId: oid, deadline } = pendingDispute as {
                orderId: string
                deadline: Date
            }
            await this.jobs.removeReviewDeadline(oid)
            await this.jobs.scheduleDisputeDeadline(oid, deadline)
        }

        return result
    }

    async finalizeOrder(orderId: string): Promise<{ order: OrderDetail; refs: MoneyMoveRefs } | null> {
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            // Row lock — see acceptDelivery; prevents a double escrow release.
            await tx.$queryRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`
            const order = await tx.order.findUnique({ where: { id: orderId } })
            if (!order) return null
            if (order.status !== 'AwaitingFinalization') return null

            const now = new Date()
            const updated = await tx.order.update({
                where: { id: orderId },
                data: { status: 'Completed', completedAt: now },
                include: this.orderIncludes
            })
            await tx.gig.update({ where: { id: order.gigId }, data: { completedOrderCount: { increment: 1 } } })

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
                    type: 'Finalized',
                    actorUserId: null,
                    payload: { earningId: earning.id, platformFeeId: platformFee.id }
                }
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'order_finalized',
                payload: {
                    number: order.number,
                    sellerShare: earning.amountVnd,
                    platformShare: platformFee.amountVnd,
                    text: `${formatOrderCode(order.number)} finalized — funds released to ${actorName(updated.seller)}`
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
        if (result) {
            await this.jobs.removeDisputeDeadline(orderId)
        }

        return result
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
            // Approximated as placedAt desc for now; proper urgency sort needs a SQL CASE.
            return [{ placedAt: 'desc' as const }]
    }
}

void EXTENSION_WINDOW_MS
void CANCELLATION_WINDOW_MS
void DISPUTE_WINDOW_MS
