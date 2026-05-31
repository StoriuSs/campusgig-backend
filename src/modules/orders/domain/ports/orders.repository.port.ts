export const ORDERS_REPOSITORY_PORT = 'ORDERS_REPOSITORY_PORT'

// Mirror of Prisma enums — keep in sync with the schema.
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

// avatarKey is an S3 key; controllers resolve to presigned URLs before responding.
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
    hoursRequested: number
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

// Used by the workspace context column and the orders list row.
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

// Full detail for the Order Workspace page.
export interface OrderDetail extends OrderItem {
    latestDelivery: DeliveryItem | null
    pendingExtension: ExtensionItem | null
    pendingCancellation: CancellationItem | null
    deliveryCount: number // for "Previous versions" toggle visibility
}

// Pre-flattened row for the Orders list page. `actionRequired` is computed in SQL.
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
    acceptDeadline: Date | null
    deliveryDeadline: Date | null
    reviewDeadline: Date | null
    disputeDeadline: Date | null
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

export interface MoneyMoveRefs {
    paymentId?: string
    refundId?: string
    earningId?: string
    platformFeeId?: string
}

export interface OrdersRepositoryPort {
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
    // Active (not Completed/Cancelled) orders between viewer and one counterparty in either direction.
    listActiveBetween(viewerId: string, otherUserId: string): Promise<OrderListRow[]>
    listDeliveries(orderId: string, viewerId: string): Promise<DeliveryItem[]>
    getDeliveryFileForResolve(
        orderId: string,
        deliveryId: string,
        fileId: string,
        viewerId: string
    ): Promise<{ id: string; key: string; name: string } | null>

    // File is already in S3 but not yet linked to a Delivery row.
    // SendDeliverWork / SendUpdateDelivery claim it inside their $transactions.
    stageDeliveryFile(input: {
        sellerId: string
        orderId: string
        key: string
        name: string
        size: number
        mime: string
    }): Promise<DeliveryFileItem>

    // All transitions are atomic ($transaction). Return null when the order has
    // already moved past the source state (idempotent guard for late-firing jobs).
    // Throw InvalidTransitionException when source state doesn't match.

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

    requestExtension(input: {
        orderId: string
        viewerId: string
        hoursRequested: number
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

    autoCancelOrder(orderId: string): Promise<OrderDetail | null>
    markLate(orderId: string): Promise<OrderDetail | null>
    autoCompleteOrder(orderId: string): Promise<OrderDetail | null>
    finalizeOrder(orderId: string): Promise<{
        order: OrderDetail
        refs: MoneyMoveRefs
    } | null>

    expireExtension(extensionId: string): Promise<{ order: OrderDetail; extension: ExtensionItem } | null>
    expireCancellation(cancellationId: string): Promise<{ order: OrderDetail; cancellation: CancellationItem } | null>
}
