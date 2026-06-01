import { Inject, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'
import { formatOrderCode } from '@/shared/utils'
import { PLATFORM_FEE_COLLECTOR_USER_ID } from '@/shared/constants/platform'
import { MESSAGING_REPOSITORY_PORT, MessageItem, MessagingRepositoryPort } from '@/modules/messaging/domain/ports'
import { SocketEmitter } from '@/modules/messaging/application/events/handlers'
import { WALLET_REPOSITORY_PORT, WalletRepositoryPort } from '@/modules/wallet/domain/ports/wallet.repository.port'
import type { MoneyMoveRefs } from '@/modules/orders/domain/ports'

import {
    AddEvidenceInput,
    AdminDeliveryItem,
    AdminDisputeDetail,
    AdminDisputeFilters,
    AdminDisputeListResult,
    AdminDisputeParty,
    AdminDisputeRow,
    AdminEvidenceItem,
    DISPUTES_REPOSITORY_PORT,
    DisputeEvidenceItem,
    DisputeMutationResult,
    DisputeRecord,
    DisputeResolveResult,
    DisputesRepositoryPort,
    FileDisputeInput,
    ResolveDisputeInput,
    RespondToDisputeInput
} from '../../domain/ports/disputes.repository.port'
import { DisputeParty, DisputeReasonCode, DisputeVerdict } from '../../domain/dispute.types'
import { computeDisputePayout } from '../../domain/services/compute-dispute-payout'
import {
    AlreadyRespondedException,
    DisputeAlreadyExistsException,
    DisputeNotFoundException,
    DisputeNotReviewableException,
    NotAParticipantException,
    NotDisputableStateException
} from '../../domain/exceptions'

const RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000
const DISPUTABLE_STATUSES = ['InProgress', 'Late', 'Delivered', 'AwaitingFinalization']

function actorName(user: { displayName: string | null; username: string | null } | null | undefined): string {
    return user?.displayName ?? user?.username ?? 'A user'
}

function oppositeRole(role: DisputeParty): DisputeParty {
    return role === 'Buyer' ? 'Seller' : 'Buyer'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

@Injectable()
export class PrismaDisputesRepository implements DisputesRepositoryPort {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(WALLET_REPOSITORY_PORT)
        private readonly walletRepo: WalletRepositoryPort,
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly messagingRepo: MessagingRepositoryPort,
        // Emit AFTER $transaction commits so a rollback never publishes a phantom pill.
        private readonly socketEmitter: SocketEmitter
    ) {}

    // ── Mapping helpers ──────────────────────────────────────────────────────

    private mapEvidence(
        rows: { id: string; side: string; name: string; size: number; mime: string; createdAt: Date }[]
    ): DisputeEvidenceItem[] {
        return rows.map((r) => ({
            id: r.id,
            side: r.side as DisputeParty,
            name: r.name,
            size: r.size,
            mime: r.mime,
            createdAt: r.createdAt
        }))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private mapRecord(d: any): DisputeRecord {
        const filerRole = d.filedByRole as DisputeParty
        const evidence = this.mapEvidence(d.evidence ?? [])
        return {
            id: d.id,
            orderId: d.orderId,
            filedByUserId: d.filedByUserId,
            filedByRole: filerRole,
            reasonCode: d.reasonCode as DisputeReasonCode,
            filerStatement: d.filerStatement,
            respondedAt: d.respondedAt,
            responderStatement: d.responderStatement,
            status: d.status,
            responseDeadline: d.responseDeadline,
            verdict: d.verdict,
            buyerRefundPercent: d.buyerRefundPercent,
            resolvedAt: d.resolvedAt,
            filedAt: d.filedAt,
            filerEvidence: evidence.filter((e) => e.side === filerRole),
            responderEvidence: evidence.filter((e) => e.side === oppositeRole(filerRole))
        }
    }

    private emitSystemEventMessage(threadId: string, message: MessageItem): void {
        this.socketEmitter.emitToThread(threadId, 'message:new', {
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
        })
    }

    private async reloadRecord(client: AnyClient, disputeId: string): Promise<DisputeRecord> {
        const reloaded = await client.dispute.findUnique({
            where: { id: disputeId },
            include: { evidence: { orderBy: { createdAt: 'asc' } } }
        })
        return this.mapRecord(reloaded)
    }

    // ── Writes ─────────────────────────────────────────────────────────────────

    async fileDispute(input: FileDisputeInput): Promise<DisputeMutationResult> {
        let pending: { threadId: string; message: MessageItem } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: input.orderId },
                include: {
                    buyer: { select: { id: true, displayName: true, username: true } },
                    seller: { select: { id: true, displayName: true, username: true } }
                }
            })
            if (!order) throw new NotFoundException(`Order ${input.orderId} not found`)
            if (order.buyerId !== input.viewerId && order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId)
            }
            if (!DISPUTABLE_STATUSES.includes(order.status)) {
                throw new NotDisputableStateException(order.status)
            }
            const existing = await tx.dispute.findUnique({ where: { orderId: input.orderId }, select: { id: true } })
            if (existing) throw new DisputeAlreadyExistsException(input.orderId)

            const role: DisputeParty = order.buyerId === input.viewerId ? 'Buyer' : 'Seller'
            const now = new Date()
            const dispute = await tx.dispute.create({
                data: {
                    orderId: input.orderId,
                    filedByUserId: input.viewerId,
                    filedByRole: role,
                    reasonCode: input.reasonCode,
                    filerStatement: input.statement,
                    status: 'AwaitingResponse',
                    responseDeadline: new Date(now.getTime() + RESPONSE_WINDOW_MS),
                    filedAt: now
                }
            })
            await this.claimEvidence(tx, input.orderId, input.viewerId, role, input.evidenceFileIds, dispute.id)

            await tx.order.update({ where: { id: input.orderId }, data: { status: 'Frozen' } })
            await tx.orderEvent.create({
                data: {
                    orderId: input.orderId,
                    type: 'DisputeFiled',
                    actorUserId: input.viewerId,
                    payload: { number: order.number, role, reasonCode: input.reasonCode }
                }
            })

            const filerUser = role === 'Buyer' ? order.buyer : order.seller
            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: input.orderId,
                type: 'dispute_filed',
                payload: {
                    number: order.number,
                    actorId: input.viewerId,
                    role,
                    text: `${actorName(filerUser)} filed a dispute on ${formatOrderCode(order.number)}`
                },
                at: now,
                tx
            })
            pending = { threadId: thread.id, message: sysMsg }

            return { orderId: input.orderId, dispute: await this.reloadRecord(tx, dispute.id) }
        })

        const sent = pending as { threadId: string; message: MessageItem } | null
        if (sent) this.emitSystemEventMessage(sent.threadId, sent.message)
        return result
    }

    async respondToDispute(input: RespondToDisputeInput): Promise<DisputeMutationResult> {
        return this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: input.orderId },
                select: { buyerId: true, sellerId: true }
            })
            if (!order) throw new NotFoundException(`Order ${input.orderId} not found`)
            if (order.buyerId !== input.viewerId && order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId)
            }
            const dispute = await tx.dispute.findUnique({ where: { orderId: input.orderId } })
            if (!dispute) throw new DisputeNotFoundException(input.orderId)
            // The counterparty (not the filer) is the one who responds.
            if (dispute.filedByUserId === input.viewerId) throw new NotAParticipantException(input.orderId)
            if (dispute.status !== 'AwaitingResponse' || dispute.respondedAt) {
                throw new AlreadyRespondedException(input.orderId)
            }

            const role: DisputeParty = order.buyerId === input.viewerId ? 'Buyer' : 'Seller'
            await tx.dispute.update({
                where: { id: dispute.id },
                data: { respondedAt: new Date(), responderStatement: input.statement, status: 'ReadyForReview' }
            })
            await this.claimEvidence(tx, input.orderId, input.viewerId, role, input.evidenceFileIds, dispute.id)

            return { orderId: input.orderId, dispute: await this.reloadRecord(tx, dispute.id) }
        })
    }

    async addEvidence(input: AddEvidenceInput): Promise<DisputeMutationResult> {
        return this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: input.orderId },
                select: { buyerId: true, sellerId: true }
            })
            if (!order) throw new NotFoundException(`Order ${input.orderId} not found`)
            if (order.buyerId !== input.viewerId && order.sellerId !== input.viewerId) {
                throw new NotAParticipantException(input.orderId)
            }
            const dispute = await tx.dispute.findUnique({ where: { orderId: input.orderId } })
            if (!dispute) throw new DisputeNotFoundException(input.orderId)
            // Evidence can be added while the case is open (before resolution).
            if (dispute.status === 'Resolved') throw new DisputeNotReviewableException(dispute.status)

            const role: DisputeParty = order.buyerId === input.viewerId ? 'Buyer' : 'Seller'
            await this.claimEvidence(tx, input.orderId, input.viewerId, role, input.evidenceFileIds, dispute.id)

            return { orderId: input.orderId, dispute: await this.reloadRecord(tx, dispute.id) }
        })
    }

    async resolve(orderId: string, adminId: string, input: ResolveDisputeInput): Promise<DisputeResolveResult> {
        let pending: { threadId: string; message: MessageItem } | null = null

        const result = await this.prisma.$transaction(async (tx) => {
            const dispute = await tx.dispute.findUnique({ where: { orderId } })
            if (!dispute) throw new DisputeNotFoundException(orderId)
            if (dispute.status !== 'ReadyForReview') throw new DisputeNotReviewableException(dispute.status)

            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: {
                    buyer: { select: { id: true, displayName: true, username: true } },
                    seller: { select: { id: true, displayName: true, username: true } }
                }
            })
            if (!order) throw new NotFoundException(`Order ${orderId} not found`)

            const verdict = input.verdict as DisputeVerdict
            const payout = computeDisputePayout(order.gigPriceVndSnapshot, verdict, input.buyerRefundPercent)
            const now = new Date()
            const refs: MoneyMoveRefs = {}

            if (verdict === 'RefundBuyer') {
                const refund = await this.walletRepo.refundFromEscrow(
                    order.buyerId,
                    order.gigPriceVndSnapshot,
                    orderId,
                    tx
                )
                refs.refundId = refund.id
            } else if (verdict === 'CompleteForSeller') {
                const { earning, platformFee } = await this.walletRepo.releaseFromEscrow(
                    order.buyerId,
                    order.sellerId,
                    PLATFORM_FEE_COLLECTOR_USER_ID,
                    order.gigPriceVndSnapshot,
                    20,
                    orderId,
                    tx
                )
                refs.earningId = earning.id
                refs.platformFeeId = platformFee.id
            } else {
                const split = await this.walletRepo.splitFromEscrow(
                    order.buyerId,
                    order.sellerId,
                    PLATFORM_FEE_COLLECTOR_USER_ID,
                    payout,
                    orderId,
                    tx
                )
                if (split.refund) refs.refundId = split.refund.id
                if (split.earning) refs.earningId = split.earning.id
                if (split.platformFee) refs.platformFeeId = split.platformFee.id
            }

            const terminalStatus = verdict === 'RefundBuyer' ? 'Cancelled' : 'Completed'
            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: terminalStatus,
                    ...(verdict === 'RefundBuyer'
                        ? {
                              cancelledAt: now,
                              cancelledByUserId: adminId,
                              cancellationReason: 'Dispute resolved — full refund'
                          }
                        : { completedAt: now })
                }
            })
            await tx.dispute.update({
                where: { id: dispute.id },
                data: {
                    status: 'Resolved',
                    verdict,
                    buyerRefundPercent: verdict === 'SplitFunds' ? input.buyerRefundPercent : null,
                    adminNotes: input.adminNotes ?? null,
                    resolvedByUserId: adminId,
                    resolvedAt: now
                }
            })
            await tx.orderEvent.create({
                data: {
                    orderId,
                    type: 'DisputeResolved',
                    actorUserId: adminId,
                    payload: {
                        number: order.number,
                        verdict,
                        buyerRefundVnd: payout.buyerRefundVnd,
                        sellerEarningVnd: payout.sellerEarningVnd,
                        platformFeeVnd: payout.platformFeeVnd,
                        ...refs
                    }
                }
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId,
                type: 'dispute_resolved',
                payload: {
                    number: order.number,
                    verdict,
                    text: `Admin resolved the dispute on ${formatOrderCode(order.number)} — ${verdictSummary(verdict)}`
                },
                at: now,
                tx
            })
            pending = { threadId: thread.id, message: sysMsg }

            return { orderId, dispute: await this.reloadRecord(tx, dispute.id), refs }
        })

        const sent = pending as { threadId: string; message: MessageItem } | null
        if (sent) this.emitSystemEventMessage(sent.threadId, sent.message)
        return result
    }

    async expireResponse(disputeId: string): Promise<DisputeMutationResult | null> {
        return this.prisma.$transaction(async (tx) => {
            const dispute = await tx.dispute.findUnique({ where: { id: disputeId } })
            // Idempotent: only escalate if still awaiting (response may have landed first).
            if (!dispute || dispute.status !== 'AwaitingResponse') return null
            await tx.dispute.update({ where: { id: disputeId }, data: { status: 'ReadyForReview' } })
            return { orderId: dispute.orderId, dispute: await this.reloadRecord(tx, disputeId) }
        })
    }

    // Claims the caller's own staged, unclaimed evidence for this order onto the dispute.
    private async claimEvidence(
        client: AnyClient,
        orderId: string,
        uploaderId: string,
        side: DisputeParty,
        evidenceFileIds: string[],
        disputeId: string
    ): Promise<void> {
        if (evidenceFileIds.length === 0) return
        await client.disputeEvidence.updateMany({
            where: { id: { in: evidenceFileIds }, orderId, uploadedByUserId: uploaderId, side, disputeId: null },
            data: { disputeId }
        })
    }

    // ── Evidence staging ─────────────────────────────────────────────────────

    async stageEvidenceFile(input: {
        uploaderId: string
        orderId: string
        side: DisputeParty
        key: string
        name: string
        size: number
        mime: string
    }): Promise<DisputeEvidenceItem> {
        const row = await this.prisma.disputeEvidence.create({
            data: {
                orderId: input.orderId,
                uploadedByUserId: input.uploaderId,
                side: input.side,
                fileKey: input.key,
                name: input.name,
                size: input.size,
                mime: input.mime
            }
        })
        return {
            id: row.id,
            side: row.side as DisputeParty,
            name: row.name,
            size: row.size,
            mime: row.mime,
            createdAt: row.createdAt
        }
    }

    async findEvidenceFile(
        evidenceId: string
    ): Promise<{ id: string; key: string; name: string; orderId: string } | null> {
        const row = await this.prisma.disputeEvidence.findUnique({
            where: { id: evidenceId },
            select: { id: true, fileKey: true, name: true, orderId: true }
        })
        return row ? { id: row.id, key: row.fileKey, name: row.name, orderId: row.orderId } : null
    }

    // ── Admin reads ──────────────────────────────────────────────────────────

    async listForAdmin(filters: AdminDisputeFilters): Promise<AdminDisputeListResult> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {}
        if (filters.status === 'ready') where.status = 'ReadyForReview'
        else if (filters.status === 'awaiting') where.status = 'AwaitingResponse'
        else if (filters.status === 'resolved') where.status = 'Resolved'
        if (filters.filedBy === 'buyer') where.filedByRole = 'Buyer'
        else if (filters.filedBy === 'seller') where.filedByRole = 'Seller'

        const orderBy =
            filters.sort === 'newest'
                ? { filedAt: 'desc' as const }
                : filters.sort === 'amount_desc'
                  ? { order: { gigPriceVndSnapshot: 'desc' as const } }
                  : { filedAt: 'asc' as const }

        const skip = (filters.page - 1) * filters.pageSize
        const partySelect = { select: { id: true, username: true, displayName: true, avatarUrl: true } }

        const [rows, total, ready, awaiting, resolved] = await this.prisma.$transaction([
            this.prisma.dispute.findMany({
                where,
                orderBy,
                skip,
                take: filters.pageSize,
                include: {
                    order: {
                        select: {
                            number: true,
                            gigTitleSnapshot: true,
                            gigPriceVndSnapshot: true,
                            buyer: partySelect,
                            seller: partySelect
                        }
                    }
                }
            }),
            this.prisma.dispute.count({ where }),
            this.prisma.dispute.count({ where: { status: 'ReadyForReview' } }),
            this.prisma.dispute.count({ where: { status: 'AwaitingResponse' } }),
            this.prisma.dispute.count({ where: { status: 'Resolved' } })
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: AdminDisputeRow[] = rows.map((d: any) => ({
            orderId: d.orderId,
            number: d.order.number,
            gigTitle: d.order.gigTitleSnapshot,
            status: d.status,
            filedByRole: d.filedByRole as DisputeParty,
            filedAt: d.filedAt,
            responseDeadline: d.responseDeadline,
            amountVnd: d.order.gigPriceVndSnapshot,
            buyer: toPartySummary(d.order.buyer),
            seller: toPartySummary(d.order.seller)
        }))
        return { items, total, counts: { ready, awaiting, resolved } }
    }

    async getForAdmin(orderId: string): Promise<AdminDisputeDetail | null> {
        const d = await this.prisma.dispute.findUnique({
            where: { orderId },
            include: {
                evidence: { orderBy: { createdAt: 'asc' } },
                order: {
                    select: {
                        number: true,
                        gigId: true,
                        gigPriceVndSnapshot: true,
                        gigTitleSnapshot: true,
                        placedAt: true,
                        buyer: { select: USER_STATS_SELECT },
                        seller: { select: USER_STATS_SELECT },
                        deliveries: { orderBy: { version: 'desc' as const }, include: { files: true } }
                    }
                }
            }
        })
        if (!d) return null

        const filerRole = d.filedByRole as DisputeParty
        const oppositeR = oppositeRole(filerRole)

        const adminEvidence = (side: DisputeParty): AdminEvidenceItem[] =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (d.evidence as any[])
                .filter((e) => e.side === side)
                .map((e) => ({
                    id: e.id,
                    side: e.side as DisputeParty,
                    name: e.name,
                    size: e.size,
                    mime: e.mime,
                    createdAt: e.createdAt,
                    fileKey: e.fileKey
                }))

        const buyerUser = d.order.buyer
        const sellerUser = d.order.seller
        const filerUser = filerRole === 'Buyer' ? buyerUser : sellerUser
        const responderUser = filerRole === 'Buyer' ? sellerUser : buyerUser

        const payout =
            d.verdict != null
                ? computeDisputePayout(d.order.gigPriceVndSnapshot, d.verdict as DisputeVerdict, d.buyerRefundPercent)
                : null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deliveries: AdminDeliveryItem[] = (d.order.deliveries as any[]).map((dl) => ({
            id: dl.id,
            version: dl.version,
            note: dl.note,
            deliveredAt: dl.deliveredAt,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            files: (dl.files ?? []).map((f: any) => ({
                id: f.id,
                name: f.name,
                size: f.size,
                mime: f.mime,
                fileKey: f.key
            }))
        }))

        return {
            orderId,
            number: d.order.number,
            gigId: d.order.gigId,
            status: d.status,
            amountVnd: d.order.gigPriceVndSnapshot,
            gigTitle: d.order.gigTitleSnapshot,
            placedAt: d.order.placedAt,
            filedAt: d.filedAt,
            respondedAt: d.respondedAt,
            responseDeadline: d.responseDeadline,
            filer: toAdminParty(
                filerUser,
                filerRole,
                d.reasonCode as DisputeReasonCode,
                d.filerStatement,
                adminEvidence(filerRole)
            ),
            counterparty: toAdminParty(responderUser, oppositeR, null, d.responderStatement, adminEvidence(oppositeR)),
            verdict: d.verdict,
            buyerRefundPercent: d.buyerRefundPercent,
            adminNotes: d.adminNotes,
            resolvedAt: d.resolvedAt,
            payout,
            deliveries
        }
    }
}

function verdictSummary(verdict: DisputeVerdict): string {
    if (verdict === 'RefundBuyer') return 'full refund to buyer'
    if (verdict === 'CompleteForSeller') return 'completed for seller'
    return 'funds split'
}

function toPartySummary(u: {
    id: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
}) {
    return { id: u.id, username: u.username, displayName: u.displayName, avatarKey: u.avatarUrl }
}

const USER_STATS_SELECT = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    endorsedAt: true,
    reviewCount: true,
    ratingSumHalfStars: true
}

function toAdminParty(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    u: any,
    role: DisputeParty,
    reasonCode: DisputeReasonCode | null,
    statement: string | null,
    evidence: AdminEvidenceItem[]
): AdminDisputeParty {
    return {
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarKey: u.avatarUrl,
        endorsedAt: u.endorsedAt,
        reviewCount: u.reviewCount,
        ratingSumHalfStars: u.ratingSumHalfStars,
        role,
        reasonCode,
        statement,
        evidence
    }
}

export const DISPUTES_REPOSITORY_PROVIDER = {
    provide: DISPUTES_REPOSITORY_PORT,
    useClass: PrismaDisputesRepository
}
