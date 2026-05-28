import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import {
    PublicGigsRepositoryPort,
    BrowseGigsFilters,
    BrowseGigsResult,
    PublicGigSummary,
    PublicGigDetail,
    // PublicGigSellerSummary,
    PUBLIC_GIGS_REPOSITORY_PORT
} from '../../domain/ports/public-gigs.repository.port'

@Injectable()
export class PrismaPublicGigsRepository implements PublicGigsRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async browse(filters: BrowseGigsFilters): Promise<BrowseGigsResult> {
        const { q, categoryId, minPrice, maxPrice, maxDelivery, endorsedOnly, sellerId, sort, page, pageSize, userId } =
            filters
        const skip = (page - 1) * pageSize

        // Base where clause — only Active, non-deleted gigs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { status: 'Active', deletedAt: null }

        if (categoryId) where.categoryId = categoryId
        if (minPrice !== undefined) where.priceVnd = { ...where.priceVnd, gte: minPrice }
        if (maxPrice !== undefined) where.priceVnd = { ...where.priceVnd, lte: maxPrice }
        if (maxDelivery !== undefined) where.deliveryDays = { lte: maxDelivery }

        // endorsedOnly: pre-fetch endorsed seller IDs (no Gig→User relation in Prisma)
        if (endorsedOnly) {
            const endorsedUsers = await this.prisma.user.findMany({
                where: { endorsedAt: { not: null }, isAdmin: false, deletedAt: null },
                select: { id: true }
            })
            where.sellerId = { in: endorsedUsers.map((u) => u.id) }
        }

        if (sellerId) where.sellerId = sellerId

        // Full-text search: match title or description (case-insensitive)
        if (q && q.trim()) {
            const term = q.trim()
            where.OR = [
                { title: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } }
            ]
        }

        const orderBy =
            sort === 'priceAsc'
                ? [{ priceVnd: 'asc' as const }]
                : sort === 'priceDesc'
                  ? [{ priceVnd: 'desc' as const }]
                  : [{ createdAt: 'desc' as const }]

        const [rows, total] = await this.prisma.$transaction([
            this.prisma.gig.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                include: { images: { where: { position: 0 }, take: 1 } }
            }),
            this.prisma.gig.count({ where })
        ])

        if (rows.length === 0) {
            return { items: [], total, page, pageSize }
        }

        // Batch-load sellers (no Gig→User relation)
        const sellerIds = Array.from(new Set(rows.map((r) => r.sellerId)))
        const sellers = await this.prisma.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, username: true, displayName: true, avatarUrl: true, endorsedAt: true }
        })
        const sellerById = new Map(sellers.map((s) => [s.id, s]))

        // Compute isSaved set
        const savedGigIds = new Set<string>()
        if (userId) {
            const gigIds = rows.map((r) => r.id)
            const saved = await this.prisma.savedGig.findMany({
                where: { userId, gigId: { in: gigIds } },
                select: { gigId: true }
            })
            saved.forEach((s) => savedGigIds.add(s.gigId))
        }

        const items: PublicGigSummary[] = rows.map((row) => {
            const seller = sellerById.get(row.sellerId)
            return {
                id: row.id,
                title: row.title,
                priceVnd: row.priceVnd,
                deliveryDays: row.deliveryDays,
                coverImageKey: row.images[0]?.imageKey ?? null,
                avgRating: null, // F11 will populate
                reviewCount: 0,
                isSaved: savedGigIds.has(row.id),
                seller: {
                    id: row.sellerId,
                    username: seller?.username ?? null,
                    displayName: seller?.displayName ?? null,
                    avatarKey: seller?.avatarUrl ?? null,
                    isEndorsed: seller?.endorsedAt != null
                }
            }
        })

        return { items, total, page, pageSize }
    }

    async findById(id: string, userId?: string): Promise<PublicGigDetail | null> {
        const row = await this.prisma.gig.findFirst({
            where: { id, status: 'Active', deletedAt: null },
            include: {
                images: { orderBy: { position: 'asc' } },
                bullets: { orderBy: { position: 'asc' } },
                faqs: { orderBy: { position: 'asc' } }
            }
        })
        if (!row) return null

        // Fetch seller, category, and compute carousels in parallel
        const [seller, category, similarRows, otherRows] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: row.sellerId },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    bio: true,
                    roleLine: true,
                    location: true,
                    languages: true,
                    endorsedAt: true,
                    createdAt: true,
                    isAdmin: true,
                    skills: { select: { name: true }, orderBy: { position: 'asc' } }
                }
            }),
            this.prisma.category.findUnique({ where: { id: row.categoryId }, select: { name: true } }),
            this.prisma.gig.findMany({
                where: { categoryId: row.categoryId, status: 'Active', deletedAt: null, id: { not: id } },
                orderBy: { createdAt: 'desc' },
                take: 6,
                include: { images: { where: { position: 0 }, take: 1 } }
            }),
            this.prisma.gig.findMany({
                where: { sellerId: row.sellerId, status: 'Active', deletedAt: null, id: { not: id } },
                orderBy: { createdAt: 'desc' },
                take: 6,
                include: { images: { where: { position: 0 }, take: 1 } }
            })
        ])

        // Count active gigs by seller
        const sellerGigCount = await this.prisma.gig.count({
            where: { sellerId: row.sellerId, status: 'Active', deletedAt: null }
        })

        // Batch-load sellers for carousels
        const carouselSellerIds = Array.from(
            new Set([...similarRows.map((r) => r.sellerId), ...otherRows.map((r) => r.sellerId)])
        )
        const carouselSellers =
            carouselSellerIds.length > 0
                ? await this.prisma.user.findMany({
                      where: { id: { in: carouselSellerIds } },
                      select: { id: true, username: true, displayName: true, avatarUrl: true, endorsedAt: true }
                  })
                : []
        const carouselSellerById = new Map(carouselSellers.map((s) => [s.id, s]))

        // Compute isSaved
        let isSaved = false
        if (userId) {
            const saved = await this.prisma.savedGig.findUnique({
                where: { userId_gigId: { userId, gigId: id } }
            })
            isSaved = saved != null
        }

        const toSummary = (r: (typeof similarRows)[0]): PublicGigSummary => {
            const s = carouselSellerById.get(r.sellerId)
            return {
                id: r.id,
                title: r.title,
                priceVnd: r.priceVnd,
                deliveryDays: r.deliveryDays,
                coverImageKey: r.images[0]?.imageKey ?? null,
                avgRating: null,
                reviewCount: 0,
                isSaved: false,
                seller: {
                    id: r.sellerId,
                    username: s?.username ?? null,
                    displayName: s?.displayName ?? null,
                    avatarKey: s?.avatarUrl ?? null,
                    isEndorsed: s?.endorsedAt != null
                }
            }
        }

        return {
            id: row.id,
            title: row.title,
            description: row.description,
            priceVnd: row.priceVnd,
            deliveryDays: row.deliveryDays,
            categoryId: row.categoryId,
            categoryName: category?.name ?? '',
            avgRating: null,
            reviewCount: 0,
            completedOrderCount: 0,
            isSaved,
            images: row.images.map((i) => ({
                id: i.id,
                imageKey: i.imageKey,
                width: i.width,
                height: i.height,
                position: i.position
            })),
            bullets: row.bullets.map((b) => ({ id: b.id, text: b.text })),
            faqs: row.faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
            seller: {
                id: row.sellerId,
                username: seller?.username ?? null,
                displayName: seller?.displayName ?? null,
                avatarKey: seller?.avatarUrl ?? null,
                bio: seller?.bio ?? null,
                roleLine: seller?.roleLine ?? null,
                location: seller?.location ?? null,
                languages: seller?.languages ?? null,
                skills: seller?.skills?.map((s) => s.name) ?? [],
                isEndorsed: seller?.endorsedAt != null,
                joinedAt: seller?.createdAt ?? new Date(),
                gigCount: sellerGigCount,
                avgRating: null,
                reviewCount: 0,
                completedOrderCount: 0
            },
            similarGigs: similarRows.map(toSummary),
            otherBySellerGigs: otherRows.map(toSummary)
        }
    }
}

export { PUBLIC_GIGS_REPOSITORY_PORT }
