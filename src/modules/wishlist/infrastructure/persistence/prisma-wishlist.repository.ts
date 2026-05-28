import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import {
    WishlistRepositoryPort,
    GetWishlistResult,
    WishlistGigItem,
    WishlistSort
} from '../../domain/ports/wishlist.repository.port'

@Injectable()
export class PrismaWishlistRepository implements WishlistRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async save(userId: string, gigId: string): Promise<void> {
        const gig = await this.prisma.gig.findFirst({
            where: { id: gigId, status: 'Active', deletedAt: null },
            select: { id: true }
        })
        if (!gig) throw new BadRequestException('Gig is not available')

        await this.prisma.savedGig.upsert({
            where: { userId_gigId: { userId, gigId } },
            create: { userId, gigId },
            update: {}
        })
    }

    async unsave(userId: string, gigId: string): Promise<void> {
        await this.prisma.savedGig.deleteMany({ where: { userId, gigId } })
    }

    async list(userId: string, page: number, pageSize: number, sort: WishlistSort): Promise<GetWishlistResult> {
        const skip = (page - 1) * pageSize

        const orderBy =
            sort === 'priceAsc'
                ? [{ gig: { priceVnd: 'asc' as const } }]
                : sort === 'priceDesc'
                  ? [{ gig: { priceVnd: 'desc' as const } }]
                  : [{ savedAt: 'desc' as const }]

        const [savedRows, total] = await this.prisma.$transaction([
            this.prisma.savedGig.findMany({
                where: { userId, gig: { status: 'Active', deletedAt: null } },
                orderBy,
                skip,
                take: pageSize,
                include: {
                    gig: { include: { images: { where: { position: 0 }, take: 1 } } }
                }
            }),
            this.prisma.savedGig.count({
                where: { userId, gig: { status: 'Active', deletedAt: null } }
            })
        ])

        if (savedRows.length === 0) return { items: [], total, page, pageSize }

        const sellerIds = Array.from(new Set(savedRows.map((r) => r.gig.sellerId)))
        const sellers = await this.prisma.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, username: true, displayName: true, avatarUrl: true, endorsedAt: true }
        })
        const sellerById = new Map(sellers.map((s) => [s.id, s]))

        const items: WishlistGigItem[] = savedRows.map((row) => {
            const seller = sellerById.get(row.gig.sellerId)
            return {
                id: row.gig.id,
                title: row.gig.title,
                priceVnd: row.gig.priceVnd,
                deliveryDays: row.gig.deliveryDays,
                coverImageKey: row.gig.images[0]?.imageKey ?? null,
                savedAt: row.savedAt,
                seller: {
                    id: row.gig.sellerId,
                    username: seller?.username ?? null,
                    displayName: seller?.displayName ?? null,
                    avatarKey: seller?.avatarUrl ?? null,
                    isEndorsed: seller?.endorsedAt != null
                }
            }
        })

        return { items, total, page, pageSize }
    }
}
