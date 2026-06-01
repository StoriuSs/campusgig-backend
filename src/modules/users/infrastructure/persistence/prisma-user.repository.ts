import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import {
    UserRepositoryPort,
    UserEntity,
    UserSkillEntity,
    PortfolioItemEntity,
    UsernameTakenException,
    SkillNotFoundException,
    PortfolioItemNotFoundException,
    AdminUserListFilters,
    AdminUserListResult,
    AdminUserRow,
    AdminUserDetail,
    AdminUserTopGig
} from '@/modules/users/domain'
import { UserMapper, UserSkillMapper, PortfolioItemMapper } from '../mappers/user.mapper'

/**
 * Prisma User Repository — Outbound Adapter
 *
 * Implements the UserRepositoryPort using Prisma as the persistence layer.
 * All Prisma-specific concerns (error codes, types, queries) are contained here.
 * The domain/application layers never see Prisma.
 */
@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async findById(id: string): Promise<UserEntity | null> {
        const user = await this.prisma.user.findFirst({
            where: { id, deletedAt: null }
        })
        return user ? UserMapper.toDomain(user) : null
    }

    async findByKeycloakId(keycloakId: string): Promise<UserEntity | null> {
        const user = await this.prisma.user.findUnique({
            where: { keycloakId }
        })
        return user ? UserMapper.toDomain(user) : null
    }

    async findByUsername(username: string): Promise<UserEntity | null> {
        const user = await this.prisma.user.findUnique({
            where: { username }
        })
        return user ? UserMapper.toDomain(user) : null
    }

    async create(data: {
        keycloakId: string
        email?: string | null
        displayName?: string | null
    }): Promise<UserEntity> {
        const user = await this.prisma.user.create({
            data: {
                keycloakId: data.keycloakId,
                email: data.email ?? undefined,
                displayName: data.displayName ?? undefined
            }
        })
        return UserMapper.toDomain(user)
    }

    async update(
        id: string,
        data: Partial<
            Pick<
                UserEntity,
                | 'username'
                | 'displayName'
                | 'avatarUrl'
                | 'bio'
                | 'hasSetUsername'
                | 'email'
                | 'location'
                | 'roleLine'
                | 'languages'
                | 'endorsedAt'
                | 'endorsedBy'
                | 'adminNote'
                | 'deletedAt'
                | 'deletedBy'
            >
        >
    ): Promise<UserEntity> {
        try {
            const prismaData = UserMapper.toPersistence(data)
            const user = await this.prisma.user.update({
                where: { id },
                data: prismaData
            })
            return UserMapper.toDomain(user)
        } catch (error: unknown) {
            // Translate Prisma P2002 (unique constraint) into domain exception
            const prismaError = error as { code?: string; meta?: { target?: string[] } }
            if (prismaError?.code === 'P2002') {
                const field = prismaError.meta?.target?.[0] || 'unknown'
                throw new UsernameTakenException(field)
            }
            throw error
        }
    }

    async findAvatarUrl(userId: string): Promise<string | null> {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            select: { avatarUrl: true }
        })
        return user?.avatarUrl ?? null
    }

    // ────────────────────────────────────────────────────────────────────
    // Profile views (Feature 02)
    // ────────────────────────────────────────────────────────────────────

    async findWithRelations(id: string) {
        const row = await this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            include: {
                skills: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
                portfolioItems: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }
            }
        })
        if (!row) return null
        const [completedOrderCount, activeGigCount] = await Promise.all([
            this.prisma.order.count({ where: { sellerId: row.id, status: 'Completed' } }),
            this.prisma.gig.count({ where: { sellerId: row.id, status: 'Active', deletedAt: null } })
        ])
        return {
            user: UserMapper.toDomain(row),
            skills: row.skills.map(UserSkillMapper.toDomain),
            portfolioItems: row.portfolioItems.map(PortfolioItemMapper.toDomain),
            completedOrderCount,
            activeGigCount
        }
    }

    async findByUsernameWithRelations(username: string) {
        // Caller is responsible for lowercasing the input (Risk 5 from the plan),
        // but defense-in-depth: lowercase here too. Username unique index is
        // already lowercase per the UsernameSetupModal validation.
        const lookup = username.toLowerCase()
        const row = await this.prisma.user.findFirst({
            where: { username: lookup, deletedAt: null },
            include: {
                skills: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
                portfolioItems: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }
            }
        })
        if (!row) return null
        const [completedOrderCount, activeGigCount] = await Promise.all([
            this.prisma.order.count({ where: { sellerId: row.id, status: 'Completed' } }),
            this.prisma.gig.count({ where: { sellerId: row.id, status: 'Active', deletedAt: null } })
        ])
        return {
            user: UserMapper.toDomain(row),
            skills: row.skills.map(UserSkillMapper.toDomain),
            portfolioItems: row.portfolioItems.map(PortfolioItemMapper.toDomain),
            completedOrderCount,
            activeGigCount
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Admin Users page (Feature 14)
    // ────────────────────────────────────────────────────────────────────

    async listForAdmin(filters: AdminUserListFilters): Promise<AdminUserListResult> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { isAdmin: false, deletedAt: null }
        if (filters.endorsedOnly) where.endorsedAt = { not: null }
        const search = filters.search?.trim()
        if (search) {
            where.OR = [
                { displayName: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        }

        // Pull the matching set (light fields), then attach derived stats. The
        // seed-scale user count makes an in-memory sort acceptable, and it's the
        // only way to order by computed columns (rating/orders/disputes).
        const [matched, totalUsers, endorsedUsers] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    email: true,
                    avatarUrl: true,
                    createdAt: true,
                    endorsedAt: true,
                    reviewCount: true,
                    ratingSumHalfStars: true
                }
            }),
            this.prisma.user.count({ where: { isAdmin: false, deletedAt: null } }),
            this.prisma.user.count({ where: { isAdmin: false, deletedAt: null, endorsedAt: { not: null } } })
        ])

        const ids = matched.map((u) => u.id)
        const { gigs, orders, disputes } = await this.aggregateSellerStats(ids)

        const rows: AdminUserRow[] = matched.map((u) => {
            const d = disputes.get(u.id) ?? { total: 0, lost: 0 }
            return {
                id: u.id,
                username: u.username,
                displayName: u.displayName,
                email: u.email,
                avatarKey: u.avatarUrl,
                createdAt: u.createdAt,
                endorsedAt: u.endorsedAt,
                activeGigCount: gigs.get(u.id) ?? 0,
                completedOrderCount: orders.get(u.id) ?? 0,
                reviewCount: u.reviewCount,
                avgRating: u.reviewCount > 0 ? u.ratingSumHalfStars / 2 / u.reviewCount : null,
                disputesLost: d.lost,
                disputesTotal: d.total
            }
        })

        this.sortAdminRows(rows, filters.sort)
        const start = (filters.page - 1) * filters.pageSize
        const items = rows.slice(start, start + filters.pageSize)

        return { items, total: rows.length, totalUsers, endorsedUsers }
    }

    async getAdminDetail(id: string): Promise<AdminUserDetail | null> {
        const user = await this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            select: {
                id: true,
                username: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                createdAt: true,
                endorsedAt: true,
                endorsedBy: true,
                adminNote: true,
                reviewCount: true,
                ratingSumHalfStars: true
            }
        })
        if (!user) return null

        const { gigs, orders, disputes } = await this.aggregateSellerStats([id])
        const d = disputes.get(id) ?? { total: 0, lost: 0 }

        const [endorser, topGigs] = await Promise.all([
            user.endorsedBy
                ? this.prisma.user.findUnique({ where: { id: user.endorsedBy }, select: { email: true } })
                : Promise.resolve(null),
            this.topGigsForSeller(id)
        ])

        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            avatarKey: user.avatarUrl,
            createdAt: user.createdAt,
            endorsedAt: user.endorsedAt,
            endorsedBy: user.endorsedBy,
            endorsedByEmail: endorser?.email ?? null,
            adminNote: user.adminNote,
            activeGigCount: gigs.get(id) ?? 0,
            completedOrderCount: orders.get(id) ?? 0,
            reviewCount: user.reviewCount,
            avgRating: user.reviewCount > 0 ? user.ratingSumHalfStars / 2 / user.reviewCount : null,
            disputesLost: d.lost,
            disputesTotal: d.total,
            topGigs
        }
    }

    // Grouped per-seller stats for a set of user ids: active gig count, completed
    // orders, and disputes (total + lost = RefundBuyer verdicts against them).
    private async aggregateSellerStats(ids: string[]): Promise<{
        gigs: Map<string, number>
        orders: Map<string, number>
        disputes: Map<string, { total: number; lost: number }>
    }> {
        if (ids.length === 0) {
            return { gigs: new Map(), orders: new Map(), disputes: new Map() }
        }

        const [gigGroups, orderGroups, disputeRows] = await Promise.all([
            this.prisma.gig.groupBy({
                by: ['sellerId'],
                where: { sellerId: { in: ids }, status: 'Active', deletedAt: null },
                _count: { _all: true }
            }),
            this.prisma.order.groupBy({
                by: ['sellerId'],
                where: { sellerId: { in: ids }, status: 'Completed' },
                _count: { _all: true }
            }),
            this.prisma.dispute.findMany({
                where: { order: { sellerId: { in: ids } } },
                select: { verdict: true, order: { select: { sellerId: true } } }
            })
        ])

        const gigs = new Map<string, number>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gigGroups.forEach((g: any) => gigs.set(g.sellerId, g._count._all))
        const orders = new Map<string, number>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderGroups.forEach((o: any) => orders.set(o.sellerId, o._count._all))

        const disputes = new Map<string, { total: number; lost: number }>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        disputeRows.forEach((row: any) => {
            const sellerId = row.order.sellerId as string
            const cur = disputes.get(sellerId) ?? { total: 0, lost: 0 }
            cur.total += 1
            if (row.verdict === 'RefundBuyer') cur.lost += 1
            disputes.set(sellerId, cur)
        })

        return { gigs, orders, disputes }
    }

    private async topGigsForSeller(sellerId: string): Promise<AdminUserTopGig[]> {
        const gigs = await this.prisma.gig.findMany({
            where: { sellerId, deletedAt: null },
            select: { id: true, title: true, status: true, reviewCount: true, ratingSumHalfStars: true }
        })
        if (gigs.length === 0) return []

        const orderGroups = await this.prisma.order.groupBy({
            by: ['gigId'],
            where: { gigId: { in: gigs.map((g) => g.id) }, status: 'Completed' },
            _count: { _all: true }
        })
        const orderCounts = new Map<string, number>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderGroups.forEach((o: any) => orderCounts.set(o.gigId, o._count._all))

        return gigs
            .map((g) => ({
                id: g.id,
                title: g.title,
                status: g.status,
                avgRating: g.reviewCount > 0 ? g.ratingSumHalfStars / 2 / g.reviewCount : null,
                reviewCount: g.reviewCount,
                orderCount: orderCounts.get(g.id) ?? 0
            }))
            .sort((a, b) => b.orderCount - a.orderCount || (b.avgRating ?? 0) - (a.avgRating ?? 0))
            .slice(0, 5)
    }

    private sortAdminRows(rows: AdminUserRow[], sort: AdminUserListFilters['sort']): void {
        const byNewest = (a: AdminUserRow, b: AdminUserRow) => b.createdAt.getTime() - a.createdAt.getTime()
        switch (sort) {
            case 'oldest':
                rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                break
            case 'highestRating':
                rows.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || byNewest(a, b))
                break
            case 'mostOrders':
                rows.sort((a, b) => b.completedOrderCount - a.completedOrderCount || byNewest(a, b))
                break
            case 'mostDisputes':
                // Order by the visible numerator (disputes lost) first so the
                // DISPUTES column ("lost / orders") sorts coherently, then by
                // total dispute involvement, then newest.
                rows.sort(
                    (a, b) => b.disputesLost - a.disputesLost || b.disputesTotal - a.disputesTotal || byNewest(a, b)
                )
                break
            case 'newest':
            default:
                rows.sort(byNewest)
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Skills (Feature 02)
    // ────────────────────────────────────────────────────────────────────

    async addSkill(userId: string, name: string): Promise<UserSkillEntity> {
        // Position = max + 1 for this user's skills. Gaps after deletes are
        // fine (we ORDER BY position) so we don't renumber.
        const max = await this.prisma.userSkill.aggregate({
            where: { userId },
            _max: { position: true }
        })
        const nextPosition = (max._max.position ?? -1) + 1

        const row = await this.prisma.userSkill.create({
            data: { userId, name, position: nextPosition }
        })
        return UserSkillMapper.toDomain(row)
    }

    async removeSkill(userId: string, skillId: string): Promise<void> {
        // deleteMany returns count; lets us check "not found OR not owned"
        // in a single query without leaking existence of other users' skills.
        const result = await this.prisma.userSkill.deleteMany({
            where: { id: skillId, userId }
        })
        if (result.count === 0) {
            throw new SkillNotFoundException(skillId)
        }
    }

    async countSkills(userId: string): Promise<number> {
        return this.prisma.userSkill.count({ where: { userId } })
    }

    // ────────────────────────────────────────────────────────────────────
    // Portfolio (Feature 02)
    // ────────────────────────────────────────────────────────────────────

    async addPortfolioItem(data: {
        userId: string
        imageKey: string
        width: number
        height: number
    }): Promise<PortfolioItemEntity> {
        const max = await this.prisma.portfolioItem.aggregate({
            where: { userId: data.userId },
            _max: { position: true }
        })
        const nextPosition = (max._max.position ?? -1) + 1

        const row = await this.prisma.portfolioItem.create({
            data: {
                userId: data.userId,
                imageKey: data.imageKey,
                width: data.width,
                height: data.height,
                position: nextPosition
            }
        })
        return PortfolioItemMapper.toDomain(row)
    }

    async removePortfolioItem(userId: string, itemId: string): Promise<PortfolioItemEntity> {
        // SELECT-then-DELETE pattern: we need the imageKey to return to the
        // caller (which will publish a PortfolioItemDeletedEvent for S3 cleanup).
        // Wrapped in a transaction so a parallel delete can't beat us between
        // the find and the delete.
        return this.prisma.$transaction(async (tx) => {
            const row = await tx.portfolioItem.findFirst({
                where: { id: itemId, userId }
            })
            if (!row) {
                throw new PortfolioItemNotFoundException(itemId)
            }
            await tx.portfolioItem.delete({ where: { id: itemId } })
            return PortfolioItemMapper.toDomain(row)
        })
    }

    async countPortfolioItems(userId: string): Promise<number> {
        return this.prisma.portfolioItem.count({ where: { userId } })
    }
}
