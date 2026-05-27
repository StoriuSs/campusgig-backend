import { GigStatus } from '../value-objects/gig-status'

/**
 * Gig Domain Entity. Pure domain — no framework, no ORM.
 */
export class GigEntity {
    readonly id: string
    readonly sellerId: string
    categoryId: string
    title: string
    description: string
    priceVnd: number
    deliveryDays: number
    status: GigStatus
    rejectionCategory: string | null
    rejectionReason: string | null
    coverImageId: string | null
    submittedAt: Date | null
    approvedAt: Date | null
    pausedAt: Date | null
    readonly createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    deletedBy: string | null

    constructor(props: {
        id: string
        sellerId: string
        categoryId: string
        title: string
        description: string
        priceVnd: number
        deliveryDays: number
        status: GigStatus
        rejectionCategory?: string | null
        rejectionReason?: string | null
        coverImageId?: string | null
        submittedAt?: Date | null
        approvedAt?: Date | null
        pausedAt?: Date | null
        createdAt?: Date
        updatedAt?: Date
        deletedAt?: Date | null
        deletedBy?: string | null
    }) {
        this.id = props.id
        this.sellerId = props.sellerId
        this.categoryId = props.categoryId
        this.title = props.title
        this.description = props.description
        this.priceVnd = props.priceVnd
        this.deliveryDays = props.deliveryDays
        this.status = props.status
        this.rejectionCategory = props.rejectionCategory ?? null
        this.rejectionReason = props.rejectionReason ?? null
        this.coverImageId = props.coverImageId ?? null
        this.submittedAt = props.submittedAt ?? null
        this.approvedAt = props.approvedAt ?? null
        this.pausedAt = props.pausedAt ?? null
        this.createdAt = props.createdAt ?? new Date()
        this.updatedAt = props.updatedAt ?? new Date()
        this.deletedAt = props.deletedAt ?? null
        this.deletedBy = props.deletedBy ?? null
    }

    get isDeleted(): boolean {
        return this.deletedAt !== null
    }

    get isOwnedBy(): (userId: string) => boolean {
        return (userId: string) => this.sellerId === userId
    }
}
