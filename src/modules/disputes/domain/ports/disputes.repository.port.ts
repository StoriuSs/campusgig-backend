import type { MoneyMoveRefs } from '@/modules/orders/domain/ports'
import { DisputeParty, DisputePayoutShares, DisputeReasonCode, DisputeStatus, DisputeVerdict } from '../dispute.types'

export const DISPUTES_REPOSITORY_PORT = 'DISPUTES_REPOSITORY_PORT'

export interface DisputeEvidenceItem {
    id: string
    side: DisputeParty
    name: string
    size: number
    mime: string
    createdAt: Date
}

// Mapped dispute row + its claimed evidence, split by side. Drives event
// payloads + read models. Never carries adminNotes into user-facing shapes.
export interface DisputeRecord {
    id: string
    orderId: string
    filedByUserId: string
    filedByRole: DisputeParty
    reasonCode: DisputeReasonCode
    filerStatement: string
    respondedAt: Date | null
    responderStatement: string | null
    status: DisputeStatus
    responseDeadline: Date
    verdict: DisputeVerdict | null
    buyerRefundPercent: number | null
    resolvedAt: Date | null
    filedAt: Date
    filerEvidence: DisputeEvidenceItem[]
    responderEvidence: DisputeEvidenceItem[]
}

// Read model embedded in OrderDetail (the orders repo maps the Prisma relation
// directly — disputes is not imported there). `payout` is present once resolved.
export interface OrderDisputeInfo {
    status: DisputeStatus
    filedByRole: DisputeParty
    reasonCode: DisputeReasonCode
    filerStatement: string
    filerEvidence: DisputeEvidenceItem[]
    responderStatement: string | null
    responderEvidence: DisputeEvidenceItem[]
    filedAt: Date
    respondedAt: Date | null
    responseDeadline: Date
    verdict: DisputeVerdict | null
    buyerRefundPercent: number | null
    // Admin's verdict reasoning — shown to both parties on the resolved order.
    adminNotes: string | null
    resolvedAt: Date | null
    payout: DisputePayoutShares | null
}

export interface FileDisputeInput {
    orderId: string
    viewerId: string
    reasonCode: DisputeReasonCode
    statement: string
    evidenceFileIds: string[]
}

export interface RespondToDisputeInput {
    orderId: string
    viewerId: string
    statement: string
    evidenceFileIds: string[]
}

export interface AddEvidenceInput {
    orderId: string
    viewerId: string
    evidenceFileIds: string[]
}

export interface ResolveDisputeInput {
    verdict: DisputeVerdict
    buyerRefundPercent?: number | null
    adminNotes?: string | null
}

// Mutations return the orderId + mapped dispute; the command handler re-reads
// OrderDetail via the orders port to publish the order:updated socket event.
export interface DisputeMutationResult {
    orderId: string
    dispute: DisputeRecord
}

export interface DisputeResolveResult extends DisputeMutationResult {
    refs: MoneyMoveRefs
}

// ── Admin list ───────────────────────────────────────────────────────────────

export interface AdminDisputePartySummary {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
}

export interface AdminDisputeRow {
    orderId: string
    number: number
    gigTitle: string
    status: DisputeStatus
    filedByRole: DisputeParty
    filedAt: Date
    responseDeadline: Date
    amountVnd: number
    buyer: AdminDisputePartySummary
    seller: AdminDisputePartySummary
}

export interface AdminDisputeListResult {
    items: AdminDisputeRow[]
    total: number
    counts: { ready: number; awaiting: number; resolved: number }
}

export interface AdminDisputeFilters {
    status: 'ready' | 'awaiting' | 'resolved' | 'all'
    filedBy: 'all' | 'buyer' | 'seller'
    sort: 'oldest' | 'newest' | 'amount_desc'
    page: number
    pageSize: number
}

// ── Admin detail (core) ──────────────────────────────────────────────────────
// Chat history + delivered files are assembled by the query handler (messaging
// + orders ports); this is the dispute-centric core, including adminNotes.

// Admin-only: carries the S3 key so the admin controller can presign inline.
export interface AdminEvidenceItem extends DisputeEvidenceItem {
    fileKey: string
}

export interface AdminDeliveryFileItem {
    id: string
    name: string
    size: number
    mime: string
    fileKey: string
}

export interface AdminDeliveryItem {
    id: string
    version: number
    note: string
    deliveredAt: Date
    files: AdminDeliveryFileItem[]
}

export interface AdminDisputeParty {
    userId: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
    endorsedAt: Date | null
    reviewCount: number
    ratingSumHalfStars: number
    role: DisputeParty
    reasonCode: DisputeReasonCode | null // null for the counterparty
    statement: string | null // null when the counterparty never responded
    evidence: AdminEvidenceItem[]
}

export interface AdminDisputeDetail {
    orderId: string
    number: number
    gigId: string
    status: DisputeStatus
    amountVnd: number
    gigTitle: string
    placedAt: Date
    filedAt: Date
    respondedAt: Date | null
    responseDeadline: Date
    filer: AdminDisputeParty
    counterparty: AdminDisputeParty
    verdict: DisputeVerdict | null
    buyerRefundPercent: number | null
    adminNotes: string | null
    resolvedAt: Date | null
    payout: DisputePayoutShares | null
    deliveries: AdminDeliveryItem[]
}

export interface DisputesRepositoryPort {
    // ── Writes (atomic $transaction; reuse wallet tx-aware methods) ──────────
    fileDispute(input: FileDisputeInput): Promise<DisputeMutationResult>
    respondToDispute(input: RespondToDisputeInput): Promise<DisputeMutationResult>
    addEvidence(input: AddEvidenceInput): Promise<DisputeMutationResult>
    resolve(orderId: string, adminId: string, input: ResolveDisputeInput): Promise<DisputeResolveResult>
    // Job-fired; idempotent. null when no longer AwaitingResponse.
    expireResponse(disputeId: string): Promise<DisputeMutationResult | null>

    // ── Evidence staging (mirror delivery-file stage-then-claim) ─────────────
    stageEvidenceFile(input: {
        uploaderId: string
        orderId: string
        side: DisputeParty
        key: string
        name: string
        size: number
        mime: string
    }): Promise<DisputeEvidenceItem>
    // For presigned download — caller (controller) enforces participant/admin authz.
    findEvidenceFile(evidenceId: string): Promise<{ id: string; key: string; name: string; orderId: string } | null>

    // ── Reads ────────────────────────────────────────────────────────────────
    // Note: OrderDetail.dispute (OrderDisputeInfo) is mapped by the orders repo
    // directly from the Prisma relation — keeps orders from importing this module.
    listForAdmin(filters: AdminDisputeFilters): Promise<AdminDisputeListResult>
    getForAdmin(orderId: string): Promise<AdminDisputeDetail | null>
}
