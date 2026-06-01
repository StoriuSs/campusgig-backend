import { UserEntity } from '../entities/user.entity'
import { UserSkillEntity } from '../entities/user-skill.entity'
import { PortfolioItemEntity } from '../entities/portfolio-item.entity'

// Same shape regardless of which lookup populated it.
export interface UserWithRelations {
    user: UserEntity
    skills: UserSkillEntity[]
    portfolioItems: PortfolioItemEntity[]
    // Profile stats (all-time). completedOrderCount = orders delivered as seller;
    // activeGigCount = currently-Active gigs.
    completedOrderCount: number
    activeGigCount: number
}

// ── Admin Users page (F14) ───────────────────────────────────────────────────

export type AdminUserSort = 'newest' | 'oldest' | 'highestRating' | 'mostOrders' | 'mostDisputes'

export interface AdminUserListFilters {
    endorsedOnly: boolean
    sort: AdminUserSort
    search?: string
    page: number
    pageSize: number
}

// Per-row stats. avgRating = ratingSumHalfStars/2/reviewCount (null = "New").
// disputesLost = verdicts against the seller (RefundBuyer); disputesTotal = all
// disputes on this seller's orders.
export interface AdminUserRow {
    id: string
    username: string | null
    displayName: string | null
    email: string | null
    avatarKey: string | null
    createdAt: Date
    endorsedAt: Date | null
    activeGigCount: number
    completedOrderCount: number
    reviewCount: number
    avgRating: number | null
    disputesLost: number
    disputesTotal: number
}

export interface AdminUserListResult {
    items: AdminUserRow[]
    total: number // matches the current filter (pagination)
    totalUsers: number // platform-wide header stat
    endorsedUsers: number // platform-wide header stat
}

export interface AdminUserTopGig {
    id: string
    title: string
    status: string
    avgRating: number | null
    reviewCount: number
    orderCount: number
}

export interface AdminUserDetail {
    id: string
    username: string | null
    displayName: string | null
    email: string | null
    avatarKey: string | null
    createdAt: Date
    endorsedAt: Date | null
    endorsedBy: string | null
    endorsedByEmail: string | null
    adminNote: string | null
    activeGigCount: number
    completedOrderCount: number
    reviewCount: number
    avgRating: number | null
    disputesLost: number
    disputesTotal: number
    topGigs: AdminUserTopGig[]
}

export interface UserRepositoryPort {
    findById(id: string): Promise<UserEntity | null>
    findByKeycloakId(keycloakId: string): Promise<UserEntity | null>
    findByUsername(username: string): Promise<UserEntity | null>

    create(data: { keycloakId: string; email?: string | null; displayName?: string | null }): Promise<UserEntity>

    // Throws UniqueConstraintException on unique violations.
    update(
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
    ): Promise<UserEntity>

    findAvatarUrl(userId: string): Promise<string | null>

    findWithRelations(id: string): Promise<UserWithRelations | null>

    // Caller must `.toLowerCase()` before passing username in.
    findByUsernameWithRelations(username: string): Promise<UserWithRelations | null>

    // Appends at position max+1. Caller enforces the 10-skill cap via countSkills.
    addSkill(userId: string, name: string): Promise<UserSkillEntity>

    // Throws SkillNotFoundException whether the skill is missing or belongs to another user.
    removeSkill(userId: string, skillId: string): Promise<void>

    countSkills(userId: string): Promise<number>

    // ── Admin Users page (F14) ───────────────────────────────────────────────
    listForAdmin(filters: AdminUserListFilters): Promise<AdminUserListResult>
    getAdminDetail(id: string): Promise<AdminUserDetail | null>

    addPortfolioItem(data: {
        userId: string
        imageKey: string
        width: number
        height: number
    }): Promise<PortfolioItemEntity>

    // Returns deleted entity so the caller can publish a PortfolioItemDeletedEvent
    // with the imageKey for the S3 cleanup handler.
    removePortfolioItem(userId: string, itemId: string): Promise<PortfolioItemEntity>

    countPortfolioItems(userId: string): Promise<number>
}

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort')
