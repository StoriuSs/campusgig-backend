import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import {
    GigRepositoryPort,
    GigEntity,
    GigImageEntity,
    GigWithRelations,
    MyGigsListResult,
    MyGigsFilters,
    MyGigsStatusFilter,
    MyGigsSort,
    CreateGigData,
    UpdateGigData,
    GigStatus,
    GigNotFoundException
} from '@/modules/gigs/domain'
import { GigMapper, GigImageMapper, GigBulletMapper, GigFaqMapper } from '../mappers/gig.mapper'

/**
 * Prisma adapter for the Gig aggregate. Hides Prisma-specific concerns
 * (transactions, status filter translation, cover-image recompute) from
 * the application layer.
 */
@Injectable()
export class PrismaGigRepository implements GigRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    // ───────────────────────────────────────────────────────────────────────
    // Reads
    // ───────────────────────────────────────────────────────────────────────

    async findById(id: string): Promise<GigEntity | null> {
        const row = await this.prisma.gig.findFirst({ where: { id, deletedAt: null } })
        return row ? GigMapper.toDomain(row) : null
    }

    async findByIdWithRelations(id: string): Promise<GigWithRelations | null> {
        const row = await this.prisma.gig.findUnique({
            where: { id },
            include: {
                images: { orderBy: { position: 'asc' } },
                bullets: { orderBy: { position: 'asc' } },
                faqs: { orderBy: { position: 'asc' } }
            }
        })
        if (!row) return null

        const category = await this.prisma.category.findUnique({
            where: { id: row.categoryId },
            select: { name: true, icon: true }
        })

        return {
            gig: GigMapper.toDomain(row),
            images: row.images.map((i) => GigImageMapper.toDomain(i)),
            bullets: row.bullets.map((b) => GigBulletMapper.toDomain(b)),
            faqs: row.faqs.map((f) => GigFaqMapper.toDomain(f)),
            categoryName: category?.name ?? '',
            categoryIcon: category?.icon ?? ''
        }
    }

    async findMine(filters: MyGigsFilters): Promise<MyGigsListResult> {
        const where = {
            sellerId: filters.sellerId,
            deletedAt: null,
            ...this.statusFilterToWhere(filters.status)
        }

        const orderBy = this.sortToOrderBy(filters.sort)
        const skip = (filters.page - 1) * filters.pageSize

        const [rows, total] = await this.prisma.$transaction([
            this.prisma.gig.findMany({
                where,
                orderBy,
                skip,
                take: filters.pageSize,
                include: { images: { where: { position: 0 }, take: 1 } }
            }),
            this.prisma.gig.count({ where })
        ])

        // Fetch category names in a single follow-up query to avoid N+1.
        const categoryIds = Array.from(new Set(rows.map((r) => r.categoryId)))
        const categories = categoryIds.length
            ? await this.prisma.category.findMany({
                  where: { id: { in: categoryIds } },
                  select: { id: true, name: true }
              })
            : []
        const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

        return {
            items: rows.map((row) => ({
                gig: GigMapper.toDomain(row),
                coverImage: row.images[0] ? GigImageMapper.toDomain(row.images[0]) : null,
                categoryName: categoryNameById.get(row.categoryId) ?? ''
            })),
            total
        }
    }

    async countByStatus(sellerId: string): Promise<Record<MyGigsStatusFilter, number>> {
        const where = { sellerId, deletedAt: null }
        const [all, active, paused, pending, rejected] = await this.prisma.$transaction([
            this.prisma.gig.count({ where: { ...where, NOT: { status: 'Deleted' } } }),
            this.prisma.gig.count({ where: { ...where, status: 'Active' } }),
            this.prisma.gig.count({ where: { ...where, status: 'Paused' } }),
            this.prisma.gig.count({ where: { ...where, status: 'Pending' } }),
            this.prisma.gig.count({ where: { ...where, status: 'Rejected' } })
        ])
        return { all, active, paused, pending, rejected }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Writes
    // ───────────────────────────────────────────────────────────────────────

    async create(data: CreateGigData, nextStatus: GigStatus): Promise<GigEntity> {
        return this.prisma.$transaction(async (tx) => {
            const now = new Date()
            const gig = await tx.gig.create({
                data: {
                    sellerId: data.sellerId,
                    categoryId: data.categoryId,
                    title: data.title,
                    description: data.description,
                    priceVnd: data.priceVnd,
                    deliveryDays: data.deliveryDays,
                    status: nextStatus,
                    submittedAt: nextStatus === 'Pending' ? now : null
                }
            })

            // Attach images: set gigId + position 0..n-1.
            for (let i = 0; i < data.imageIds.length; i++) {
                await tx.gigImage.update({
                    where: { id: data.imageIds[i] },
                    data: { gigId: gig.id, position: i }
                })
            }

            // Cache coverImageId from the first image.
            const updated = await tx.gig.update({
                where: { id: gig.id },
                data: { coverImageId: data.imageIds[0] ?? null }
            })

            // Insert bullets + faqs in received order.
            if (data.bullets.length > 0) {
                await tx.gigBullet.createMany({
                    data: data.bullets.map((text, position) => ({ gigId: gig.id, text, position }))
                })
            }
            if (data.faqs.length > 0) {
                await tx.gigFaq.createMany({
                    data: data.faqs.map((f, position) => ({
                        gigId: gig.id,
                        question: f.question,
                        answer: f.answer,
                        position
                    }))
                })
            }

            return GigMapper.toDomain(updated)
        })
    }

    async update(id: string, patch: UpdateGigData, nextStatus: GigStatus | null): Promise<GigEntity> {
        return this.prisma.$transaction(async (tx) => {
            const updatedFields: Record<string, unknown> = {}
            if (patch.title !== undefined) updatedFields.title = patch.title
            if (patch.categoryId !== undefined) updatedFields.categoryId = patch.categoryId
            if (patch.description !== undefined) updatedFields.description = patch.description
            if (patch.priceVnd !== undefined) updatedFields.priceVnd = patch.priceVnd
            if (patch.deliveryDays !== undefined) updatedFields.deliveryDays = patch.deliveryDays

            if (nextStatus !== null) {
                updatedFields.status = nextStatus
                if (nextStatus === 'Pending') {
                    updatedFields.submittedAt = new Date()
                    updatedFields.rejectionCategory = null
                    updatedFields.rejectionReason = null
                }
            }

            // Replace-all semantics on bullets / faqs / images.
            if (patch.bullets !== undefined) {
                await tx.gigBullet.deleteMany({ where: { gigId: id } })
                if (patch.bullets.length > 0) {
                    await tx.gigBullet.createMany({
                        data: patch.bullets.map((text, position) => ({ gigId: id, text, position }))
                    })
                }
            }
            if (patch.faqs !== undefined) {
                await tx.gigFaq.deleteMany({ where: { gigId: id } })
                if (patch.faqs.length > 0) {
                    await tx.gigFaq.createMany({
                        data: patch.faqs.map((f, position) => ({
                            gigId: id,
                            question: f.question,
                            answer: f.answer,
                            position
                        }))
                    })
                }
            }

            if (patch.imageIds !== undefined) {
                // Detach all current images (re-orphan them or delete? Re-orphan for simplicity —
                // the orphan cleanup job will reap any that aren't re-attached). For now: any
                // image not in the new list gets deleted; new ids get attached + positioned.
                const current = await tx.gigImage.findMany({ where: { gigId: id } })
                const newSet = new Set(patch.imageIds)
                const toRemove = current.filter((i) => !newSet.has(i.id))
                if (toRemove.length > 0) {
                    await tx.gigImage.deleteMany({
                        where: { id: { in: toRemove.map((i) => i.id) } }
                    })
                }
                for (let i = 0; i < patch.imageIds.length; i++) {
                    await tx.gigImage.update({
                        where: { id: patch.imageIds[i] },
                        data: { gigId: id, position: i }
                    })
                }
                updatedFields.coverImageId = patch.imageIds[0] ?? null
            }

            const updated = await tx.gig.update({
                where: { id },
                data: updatedFields
            })
            return GigMapper.toDomain(updated)
        })
    }

    async pause(id: string): Promise<GigEntity> {
        const updated = await this.prisma.gig.update({
            where: { id },
            data: { status: 'Paused', pausedAt: new Date() }
        })
        return GigMapper.toDomain(updated)
    }

    async resume(id: string): Promise<GigEntity> {
        const updated = await this.prisma.gig.update({
            where: { id },
            data: { status: 'Active', pausedAt: null }
        })
        return GigMapper.toDomain(updated)
    }

    async softDelete(id: string, actorId: string): Promise<void> {
        await this.prisma.gig.update({
            where: { id },
            data: {
                status: 'Deleted',
                deletedAt: new Date(),
                deletedBy: actorId
            }
        })
    }

    // ───────────────────────────────────────────────────────────────────────
    // Images
    // ───────────────────────────────────────────────────────────────────────

    async createOrphanImage(data: {
        imageKey: string
        width: number
        height: number
        uploaderId: string
    }): Promise<GigImageEntity> {
        const row = await this.prisma.gigImage.create({
            data: {
                gigId: null,
                imageKey: data.imageKey,
                width: data.width,
                height: data.height,
                position: 0,
                uploaderId: data.uploaderId
            }
        })
        return GigImageMapper.toDomain(row)
    }

    async findImageById(id: string): Promise<GigImageEntity | null> {
        const row = await this.prisma.gigImage.findUnique({ where: { id } })
        return row ? GigImageMapper.toDomain(row) : null
    }

    async deleteImage(id: string): Promise<void> {
        await this.prisma.gigImage.delete({ where: { id } })
    }

    async reorderImages(gigId: string, imageIds: string[]): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            // Verify ownership of every image
            const current = await tx.gigImage.findMany({ where: { gigId } })
            const currentIdSet = new Set(current.map((i) => i.id))
            for (const imageId of imageIds) {
                if (!currentIdSet.has(imageId)) {
                    throw new GigNotFoundException(imageId)
                }
            }
            if (imageIds.length !== current.length) {
                // Reorder must reference every image exactly once.
                throw new Error(
                    `Reorder list length mismatch: gig has ${current.length} images, got ${imageIds.length}`
                )
            }

            for (let i = 0; i < imageIds.length; i++) {
                await tx.gigImage.update({
                    where: { id: imageIds[i] },
                    data: { position: i }
                })
            }
            await tx.gig.update({
                where: { id: gigId },
                data: { coverImageId: imageIds[0] ?? null }
            })
        })
    }

    async findGigImages(gigId: string): Promise<GigImageEntity[]> {
        const rows = await this.prisma.gigImage.findMany({
            where: { gigId },
            orderBy: { position: 'asc' }
        })
        return rows.map((r) => GigImageMapper.toDomain(r))
    }

    // ───────────────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────────────

    private statusFilterToWhere(filter: MyGigsStatusFilter): {
        status?: { in?: string[]; equals?: string; not?: string }
    } {
        switch (filter) {
            case 'active':
                return { status: { equals: 'Active' } }
            case 'paused':
                return { status: { equals: 'Paused' } }
            case 'pending':
                return { status: { equals: 'Pending' } }
            case 'rejected':
                return { status: { equals: 'Rejected' } }
            case 'all':
            default:
                // Exclude Deleted from "all"
                return { status: { not: 'Deleted' } }
        }
    }

    private sortToOrderBy(sort: MyGigsSort): { createdAt?: 'asc' | 'desc'; updatedAt?: 'asc' | 'desc' } {
        switch (sort) {
            case 'oldest':
                return { createdAt: 'asc' }
            case 'recentlyUpdated':
                return { updatedAt: 'desc' }
            // mostOrders / highestRated / highestEarnings need Feature 09/11 data.
            // Until then they have no real column to sort on, so they fall back
            // to newest-first (stable no-op). When orders/reviews land, this
            // switch gets joins/aggregates for those cases.
            case 'mostOrders':
            case 'highestRated':
            case 'highestEarnings':
            case 'newest':
            default:
                return { createdAt: 'desc' }
        }
    }
}
