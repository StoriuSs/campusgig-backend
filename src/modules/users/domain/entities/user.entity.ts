/**
 * User Domain Entity
 *
 * This is a pure domain object with ZERO framework dependencies.
 * It mirrors the database schema but is completely ORM-independent.
 * The mapper (infrastructure layer) converts between this and Prisma's generated type.
 */
export class UserEntity {
    readonly id: string
    readonly keycloakId: string

    username: string | null
    email: string | null
    displayName: string | null
    avatarUrl: string | null
    bio: string | null
    hasSetUsername: boolean

    // Profile fields (Feature 02)
    location: string | null
    roleLine: string | null
    languages: string | null

    // Endorsed-badge fields. endorsedAt !== null means "user is endorsed."
    endorsedAt: Date | null
    endorsedBy: string | null

    // Free-text admin note (F14, admin-only).
    adminNote: string | null

    // Admin role flag — set by JIT provisioner from JWT `realm_access.roles`.
    // Buyer/seller queries filter `WHERE isAdmin = false` to keep admins out.
    isAdmin: boolean

    // Per-seller rating aggregate (F11). avg (1-5) = ratingSumHalfStars / 2 / reviewCount.
    reviewCount: number
    ratingSumHalfStars: number

    // Email-notification preferences (F17). Master kill-switch + per-category.
    emailNotificationsEnabled: boolean
    emailOrders: boolean
    emailDisputes: boolean
    emailGigs: boolean

    readonly createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    deletedBy: string | null

    constructor(props: {
        id: string
        keycloakId: string
        username?: string | null
        email?: string | null
        displayName?: string | null
        avatarUrl?: string | null
        bio?: string | null
        hasSetUsername?: boolean
        location?: string | null
        roleLine?: string | null
        languages?: string | null
        endorsedAt?: Date | null
        endorsedBy?: string | null
        adminNote?: string | null
        isAdmin?: boolean
        reviewCount?: number
        ratingSumHalfStars?: number
        emailNotificationsEnabled?: boolean
        emailOrders?: boolean
        emailDisputes?: boolean
        emailGigs?: boolean
        createdAt?: Date
        updatedAt?: Date
        deletedAt?: Date | null
        deletedBy?: string | null
    }) {
        this.id = props.id
        this.keycloakId = props.keycloakId
        this.username = props.username ?? null
        this.email = props.email ?? null
        this.displayName = props.displayName ?? null
        this.avatarUrl = props.avatarUrl ?? null
        this.bio = props.bio ?? null
        this.hasSetUsername = props.hasSetUsername ?? false
        this.location = props.location ?? null
        this.roleLine = props.roleLine ?? null
        this.languages = props.languages ?? null
        this.endorsedAt = props.endorsedAt ?? null
        this.endorsedBy = props.endorsedBy ?? null
        this.adminNote = props.adminNote ?? null
        this.isAdmin = props.isAdmin ?? false
        this.reviewCount = props.reviewCount ?? 0
        this.ratingSumHalfStars = props.ratingSumHalfStars ?? 0
        this.emailNotificationsEnabled = props.emailNotificationsEnabled ?? true
        this.emailOrders = props.emailOrders ?? true
        this.emailDisputes = props.emailDisputes ?? true
        this.emailGigs = props.emailGigs ?? true
        this.createdAt = props.createdAt ?? new Date()
        this.updatedAt = props.updatedAt ?? new Date()
        this.deletedAt = props.deletedAt ?? null
        this.deletedBy = props.deletedBy ?? null
    }

    get isDeleted(): boolean {
        return this.deletedAt !== null
    }

    get isEndorsed(): boolean {
        return this.endorsedAt !== null
    }
}
