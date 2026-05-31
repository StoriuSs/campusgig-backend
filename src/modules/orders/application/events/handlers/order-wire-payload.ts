import { formatOrderCode } from '@/shared/utils'

import type { DeliveryItem, OrderDetail } from '../../../domain/ports'

// Mirrors OrderDetailResponseDto but built without class-transformer so it can
// be sent directly over Socket.IO. The frontend's `Order` type expects this
// exact shape. Avatars are S3 keys (no presign) — the workspace already has
// presigned URLs from the initial REST fetch; realtime updates only need to
// flip status/timestamps. Coalescing avatars here would add an S3 round-trip
// per event for fields that rarely change.
export interface OrderWirePayload {
    id: string
    code: string
    number: number
    status: string
    buyer: WireParty
    seller: WireParty
    gig: WireGig
    placedAt: string
    acceptedAt: string | null
    deliveredAt: string | null
    completedAt: string | null
    cancelledAt: string | null
    autoCompletedAt: string | null
    acceptDeadline: string | null
    deliveryDeadline: string | null
    reviewDeadline: string | null
    disputeDeadline: string | null
    cancelledByUserId: string | null
    cancellationReason: string | null
    latestDelivery: WireDelivery | null
    pendingExtension: WirePendingExtension | null
    pendingCancellation: WirePendingCancellation | null
    deliveryCount: number
    review: WireReview | null
}

interface WireReview {
    id: string
    rating: number
    body: string
    replyBody: string | null
    repliedAt: string | null
    createdAt: string
}

interface WireParty {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
    endorsedAt: string | null
}

interface WireGig {
    id: string
    title: string
    priceVnd: number
    deliveryDays: number
    coverKey: string | null
}

interface WireDelivery {
    id: string
    orderId: string
    version: number
    note: string
    deliveredAt: string
    files: Array<{ id: string; name: string; size: number; mime: string; createdAt: string }>
}

interface WirePendingExtension {
    id: string
    orderId: string
    requestedById: string
    hoursRequested: number
    reason: string | null
    status: string
    expiresAt: string
    requestedAt: string
    decidedAt: string | null
    decidedById: string | null
}

interface WirePendingCancellation {
    id: string
    orderId: string
    requestedById: string
    initiator: string
    reasonCode: string
    otherText: string | null
    status: string
    expiresAt: string
    requestedAt: string
    decidedAt: string | null
    decidedById: string | null
}

export function toOrderWirePayload(order: OrderDetail): OrderWirePayload {
    return {
        id: order.id,
        code: formatOrderCode(order.number),
        number: order.number,
        status: order.status,
        buyer: {
            id: order.buyer.id,
            username: order.buyer.username,
            displayName: order.buyer.displayName,
            avatarKey: order.buyer.avatarKey,
            endorsedAt: order.buyer.endorsedAt?.toISOString() ?? null
        },
        seller: {
            id: order.seller.id,
            username: order.seller.username,
            displayName: order.seller.displayName,
            avatarKey: order.seller.avatarKey,
            endorsedAt: order.seller.endorsedAt?.toISOString() ?? null
        },
        gig: {
            id: order.gig.id,
            title: order.gig.titleSnapshot,
            priceVnd: order.gig.priceVndSnapshot,
            deliveryDays: order.gig.deliveryDays,
            coverKey: order.gig.coverKey
        },
        placedAt: order.placedAt.toISOString(),
        acceptedAt: order.acceptedAt?.toISOString() ?? null,
        deliveredAt: order.deliveredAt?.toISOString() ?? null,
        completedAt: order.completedAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        autoCompletedAt: order.autoCompletedAt?.toISOString() ?? null,
        acceptDeadline: order.acceptDeadline?.toISOString() ?? null,
        deliveryDeadline: order.deliveryDeadline?.toISOString() ?? null,
        reviewDeadline: order.reviewDeadline?.toISOString() ?? null,
        disputeDeadline: order.disputeDeadline?.toISOString() ?? null,
        cancelledByUserId: order.cancelledByUserId,
        cancellationReason: order.cancellationReason,
        latestDelivery: order.latestDelivery ? toDeliveryWire(order.latestDelivery) : null,
        pendingExtension: order.pendingExtension
            ? {
                  ...order.pendingExtension,
                  expiresAt: order.pendingExtension.expiresAt.toISOString(),
                  requestedAt: order.pendingExtension.requestedAt.toISOString(),
                  decidedAt: order.pendingExtension.decidedAt?.toISOString() ?? null
              }
            : null,
        pendingCancellation: order.pendingCancellation
            ? {
                  ...order.pendingCancellation,
                  expiresAt: order.pendingCancellation.expiresAt.toISOString(),
                  requestedAt: order.pendingCancellation.requestedAt.toISOString(),
                  decidedAt: order.pendingCancellation.decidedAt?.toISOString() ?? null
              }
            : null,
        deliveryCount: order.deliveryCount,
        review: order.review
            ? {
                  id: order.review.id,
                  rating: order.review.rating,
                  body: order.review.body,
                  replyBody: order.review.replyBody,
                  repliedAt: order.review.repliedAt?.toISOString() ?? null,
                  createdAt: order.review.createdAt.toISOString()
              }
            : null
    }
}

function toDeliveryWire(d: DeliveryItem): WireDelivery {
    return {
        id: d.id,
        orderId: d.orderId,
        version: d.version,
        note: d.note,
        deliveredAt: d.deliveredAt.toISOString(),
        files: d.files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            mime: f.mime,
            createdAt: f.createdAt.toISOString()
        }))
    }
}
