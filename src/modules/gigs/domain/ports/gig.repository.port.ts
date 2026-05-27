import { GigEntity } from '../entities/gig.entity'
import { GigImageEntity } from '../entities/gig-image.entity'
import { GigBulletEntity } from '../entities/gig-bullet.entity'
import { GigFaqEntity } from '../entities/gig-faq.entity'
import { GigStatus } from '../value-objects/gig-status'

export const GIG_REPOSITORY_PORT = 'GIG_REPOSITORY_PORT'

export interface GigWithRelations {
    gig: GigEntity
    images: GigImageEntity[]
    bullets: GigBulletEntity[]
    faqs: GigFaqEntity[]
    categoryName: string
    categoryIcon: string
}

export interface MyGigsListItem {
    gig: GigEntity
    coverImage: GigImageEntity | null
    categoryName: string
}

export interface MyGigsListResult {
    items: MyGigsListItem[]
    total: number
}

export type MyGigsStatusFilter = 'all' | 'active' | 'paused' | 'pending' | 'rejected'
// Sort options match Pencil My Gigs design. `mostOrders` / `highestRated` /
// `highestEarnings` depend on data introduced in Features 09 (orders) & 11
// (reviews); until then they sort by their currently-zero columns (stable
// no-ops that behave like `newest`). `recentlyUpdated` works today.
export type MyGigsSort = 'newest' | 'oldest' | 'mostOrders' | 'highestRated' | 'highestEarnings' | 'recentlyUpdated'

export interface MyGigsFilters {
    sellerId: string
    status: MyGigsStatusFilter
    sort: MyGigsSort
    page: number
    pageSize: number
}

export interface CreateGigData {
    sellerId: string
    categoryId: string
    title: string
    description: string
    priceVnd: number
    deliveryDays: number
    imageIds: string[]
    bullets: string[]
    faqs: Array<{ question: string; answer: string }>
}

export interface UpdateGigData {
    title?: string
    categoryId?: string
    description?: string
    priceVnd?: number
    deliveryDays?: number
    imageIds?: string[]
    bullets?: string[]
    faqs?: Array<{ question: string; answer: string }>
}

export interface GigRepositoryPort {
    // ── Reads ──────────────────────────────────────────────────────────────
    findById(id: string): Promise<GigEntity | null>
    findByIdWithRelations(id: string): Promise<GigWithRelations | null>
    findMine(filters: MyGigsFilters): Promise<MyGigsListResult>
    countByStatus(sellerId: string): Promise<Record<MyGigsStatusFilter, number>>

    // ── Writes (Phase C) ───────────────────────────────────────────────────
    create(data: CreateGigData, nextStatus: GigStatus): Promise<GigEntity>
    update(id: string, patch: UpdateGigData, nextStatus: GigStatus | null): Promise<GigEntity>
    pause(id: string): Promise<GigEntity>
    resume(id: string): Promise<GigEntity>
    softDelete(id: string, actorId: string): Promise<void>

    // ── Image management (Phase C) ────────────────────────────────────────
    createOrphanImage(data: {
        imageKey: string
        width: number
        height: number
        uploaderId: string
    }): Promise<GigImageEntity>
    findImageById(id: string): Promise<GigImageEntity | null>
    deleteImage(id: string): Promise<void>
    reorderImages(gigId: string, imageIds: string[]): Promise<void>
    findGigImages(gigId: string): Promise<GigImageEntity[]>
}
