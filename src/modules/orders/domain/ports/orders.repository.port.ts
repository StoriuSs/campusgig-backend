export const ORDERS_REPOSITORY_PORT = 'ORDERS_REPOSITORY_PORT'

// Mirrors Prisma enums so application/domain layers never depend on
// @prisma/client. Keep these unions in sync with the Prisma schema.
export type OrderStatus =
    | 'PendingReview'
    | 'InProgress'
    | 'Late'
    | 'Delivered'
    | 'AwaitingFinalization'
    | 'Completed'
    | 'Cancelled'
    | 'Frozen'

export type OrderEventType =
    | 'Placed'
    | 'Accepted'
    | 'Declined'
    | 'AutoCancelled'
    | 'Late'
    | 'Delivered'
    | 'DeliveryUpdated'
    | 'ExtensionRequested'
    | 'ExtensionAccepted'
    | 'ExtensionRejected'
    | 'ExtensionExpired'
    | 'CancellationRequested'
    | 'CancellationAccepted'
    | 'CancellationRejected'
    | 'CancellationExpired'
    | 'AcceptDelivery'
    | 'AutoCompleted'
    | 'Finalized'

export type ExtensionStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Expired'
export type CancellationStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Expired'
export type CancellationInitiator = 'Buyer' | 'Seller'
export type CancellationReasonCode =
    | 'BuyerSituationChanged'
    | 'BuyerOrderedByMistake'
    | 'BuyerAgreedInChat'
    | 'BuyerOther'
    | 'SellerScheduleConflict'
    | 'SellerRequirementsMismatch'
    | 'SellerAgreedInChat'
    | 'SellerOther'

export type OrdersSort = 'most_urgent' | 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'

// ── Shapes ────────────────────────────────────────────────────────────────

// Avatar / display fields keep S3 keys; the controller resolves them to
// presigned URLs before responding (same pattern as wallet + messaging).
export interface OrderParty {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
    endorsedAt: Date | null
}

export interface GigSnapshot {
    id: string
    titleSnapshot: string
    priceVndSnapshot: number
    deliveryDays: number
    coverKey: string | null
}

export interface DeliveryFileItem {
    id: string
    name: string
    size: number
    mime: string
    createdAt: Date
}

export interface DeliveryItem {
    id: string
    orderId: string
    version: number
    note: string
    deliveredAt: Date
    files: DeliveryFileItem[]
}

export interface ExtensionItem {
    id: string
    orderId: string
    requestedById: string
    daysRequested: number
    reason: string | null
    status: ExtensionStatus
    expiresAt: Date
    requestedAt: Date
    decidedAt: Date | null
    decidedById: string | null
}

export interface CancellationItem {
    id: string
    orderId: string
    requestedById: string
    initiator: CancellationInitiator
    reasonCode: CancellationReasonCode
    otherText: string | null
    status: CancellationStatus
    expiresAt: Date
    requestedAt: Date
    decidedAt: Date | null
    decidedById: string | null
}

export interface OrderEventItem {
    id: string
    orderId: string
    type: OrderEventType
    actorUserId: string | null
    payload: Record<string, unknown> | null
    createdAt: Date
}

// Order summary shape — used by the workspace context column + the orders
// list ROW shape (with a few extra row-level fields).
export interface OrderItem {
    id: string
    number: number
    status: OrderStatus
    buyer: OrderParty
    seller: OrderParty
    gig: GigSnapshot
    placedAt: Date
    acceptedAt: Date | null
    deliveredAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    autoCompletedAt: Date | null
    acceptDeadline: Date | null
    deliveryDeadline: Date | null
    reviewDeadline: Date | null
    disputeDeadline: Date | null
    cancelledByUserId: string | null
    cancellationReason: string | null
}

// Full detail used by the Order Workspace page — adds the latest delivery,
// pending extension/cancellation, and derived flags.
export interface OrderDetail extends OrderItem {
    latestDelivery: DeliveryItem | null
    pendingExtension: ExtensionItem | null
    pendingCancellation: CancellationItem | null
    deliveryCount: number // for "Previous versions" toggle visibility
}

// One row in the Orders list page. Pre-flattened — no nested joins on the
// frontend. `actionRequired` is computed in SQL per SRS § Order Lifecycle.
export interface OrderListRow {
    id: string
    number: number
    status: OrderStatus
    gigTitle: string
    gigCoverKey: string | null
    counterpartyId: string
    counterpartyDisplayName: string | null
    counterpartyUsername: string | null
    counterpartyAvatarKey: string | null
    placedAt: Date
    amountVnd: number
    // Deadlines surfaced to the frontend for the DEADLINE column formatter
    acceptDeadline: Date | null
    deliveryDeadline: Date | null
    reviewDeadline: Date | null
    disputeDeadline: Date | null
    // Phase-2 inputs to the formatter
    pendingExtensionExpiresAt: Date | null
    pendingCancellationExpiresAt: Date | null
    pendingCancellationInitiator: CancellationInitiator | null
    actionRequired: boolean
}

export interface OrderStatusCounts {
    all: number
    PendingReview: number
    InProgress: number
    Late: number
    Delivered: number
    AwaitingFinalization: number
    Completed: number
    Cancelled: number
}

// Wallet-side side-effect references returned by transitions that move money
export interface MoneyMoveRefs {
    paymentId?: string
    refundId?: string
    earningId?: string
    platformFeeId?: string
}

// ── Port ──────────────────────────────────────────────────────────────────

export interface OrdersRepositoryPort {
    // Reads
    findByIdForViewer(orderId: string, viewerId: string): Promise<OrderDetail | null>
    listForUser(input: {
        viewerId: string
        side: 'buyer' | 'seller'
        statusFilter: OrderStatus | 'all'
        actionRequiredOnly: boolean
        query: string | null
        sort: OrdersSort
        page: number
        pageSize: number
    }): Promise<{ items: OrderListRow[]; total: number; counts: OrderStatusCounts }>

    listEvents(orderId: string, viewerId: string): Promise<OrderEventItem[]>
    countActionRequired(viewerId: string): Promise<{ asBuyer: number; asSeller: number }>
    // Active orders between the viewer and one specific counterparty (either
    // direction). "Active" = not Completed/Cancelled. Powers the Inbox chat
    // header banner — when two people have an order in flight, the inbox
    // surfaces a chip linking straight to the order workspace.
    listActiveBetween(viewerId: string, otherUserId: string): Promise<OrderListRow[]>
    listDeliveries(orderId: string, viewerId: string): Promise<DeliveryItem[]>
    getDeliveryFileForResolve(
        orderId: string,
        deliveryId: string,
        fileId: string,
        viewerId: string
    ): Promise<{ id: string; key: string; name: string } | null>

    // Staged DeliveryFile insert — called by the upload endpoint. The file
    // is already in S3 but not yet linked to any Delivery row. SendDeliverWork
    // / SendUpdateDelivery claim it by setting `deliveryId` inside their
    // $transactions. Mirror of MessageAttachment's stageAttachment.
    stageDeliveryFile(input: {
        sellerId: string
        orderId: string
        key: string
        name: string
        size: number
        mime: string
    }): Promise<DeliveryFileItem>

    // ── Transitions ───────────────────────────────────────────────────────
    // All transitions are atomic ($transaction) and idempotent (return null /
    // existing if already in target state, throw InvalidTransitionException
    // if the source state doesn't match).

    placeOrder(input: {
        buyerId: string
        gigId: string
        idempotencyKey: string
    }): Promise<{ order: OrderDetail; refs: MoneyMoveRefs }>

    acceptOrder(orderId: string, viewerId: string): Promise<OrderDetail>
    declineOrder(orderId: string, viewerId: string, note: string): Promise<OrderDetail>

    deliverWork(input: {
        orderId: string
        viewerId: string
        note: string
        stagedFileIds: string[]
    }): Promise<{ order: OrderDetail; delivery: DeliveryItem }>

    updateDelivery(input: {
        orderId: string
        viewerId: string
        note: string
        stagedFileIds: string[]
    }): Promise<{ order: OrderDetail; delivery: DeliveryItem }>

    acceptDelivery(orderId: string, viewerId: string): Promise<{ order: OrderDetail; refs: MoneyMoveRefs }>

    // Phase 2
    requestExtension(input: {
        orderId: string
        viewerId: string
        daysRequested: number
        reason: string | null
    }): Promise<{ order: OrderDetail; extension: ExtensionItem }>

    decideExtension(input: {
        extensionId: string
        viewerId: string
        decision: 'accept' | 'reject'
    }): Promise<{ order: OrderDetail; extension: ExtensionItem }>

    requestCancellation(input: {
        orderId: string
        viewerId: string
        reasonCode: CancellationReasonCode
        otherText: string | null
    }): Promise<{ order: OrderDetail; cancellation: CancellationItem }>

    decideCancellation(input: { cancellationId: string; viewerId: string; decision: 'accept' | 'reject' }): Promise<{
        order: OrderDetail
        cancellation: CancellationItem
        refs: MoneyMoveRefs
    }>

    // ── System-driven transitions (BullMQ jobs) ──────────────────────────
    // Each returns null when the order has moved out of the source state
    // (idempotent guard) so a late-firing job never double-applies.

    autoCancelOrder(orderId: string): Promise<OrderDetail | null>
    markLate(orderId: string): Promise<OrderDetail | null>
    autoCompleteOrder(orderId: string): Promise<OrderDetail | null>
    finalizeOrder(orderId: string): Promise<{
        order: OrderDetail
        refs: MoneyMoveRefs
    } | null>

    expireExtension(extensionId: string): Promise<ExtensionItem | null>
    expireCancellation(cancellationId: string): Promise<CancellationItem | null>
}
