import { UserEntity } from '../entities/user.entity'
import { UserSkillEntity } from '../entities/user-skill.entity'
import { PortfolioItemEntity } from '../entities/portfolio-item.entity'

/**
 * Bundle returned by findWithRelations / findByUsernameWithRelations.
 * Same shape regardless of which lookup populated it.
 */
export interface UserWithRelations {
    user: UserEntity
    skills: UserSkillEntity[]
    portfolioItems: PortfolioItemEntity[]
}

/**
 * User Repository Port (Outbound)
 *
 * Defines what the application layer NEEDS from persistence.
 * The domain/application layer depends on this interface.
 * The infrastructure layer provides the concrete implementation.
 *
 * This interface must NEVER import ORM-specific types (Prisma, TypeORM, etc.)
 */
export interface UserRepositoryPort {
    findById(id: string): Promise<UserEntity | null>
    findByKeycloakId(keycloakId: string): Promise<UserEntity | null>
    findByUsername(username: string): Promise<UserEntity | null>

    /**
     * Create a new user.
     */
    create(data: { keycloakId: string; email?: string | null; displayName?: string | null }): Promise<UserEntity>

    /**
     * Update user fields.
     * Throws UniqueConstraintException (from shared domain) on unique violations.
     */
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
                | 'deletedAt'
                | 'deletedBy'
            >
        >
    ): Promise<UserEntity>

    /**
     * Find user by ID, returning only a subset of fields.
     * This is an optimization port — the adapter decides how to implement it (e.g., Prisma select).
     */
    findAvatarUrl(userId: string): Promise<string | null>

    // ────────────────────────────────────────────────────────────────────
    // Profile views (Feature 02) — User + relations in one query
    // ────────────────────────────────────────────────────────────────────

    /**
     * Find a user by ID, including their skills and portfolio items.
     * Used by GET /users/me. Returns null if user is soft-deleted or doesn't exist.
     */
    findWithRelations(id: string): Promise<UserWithRelations | null>

    /**
     * Find a user by username (case-insensitive at the call boundary — the
     * caller should `.toLowerCase()` before passing in), including relations.
     * Used by GET /users/by-username/:username (the public profile endpoint).
     */
    findByUsernameWithRelations(username: string): Promise<UserWithRelations | null>

    // ────────────────────────────────────────────────────────────────────
    // Skills (Feature 02)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Add a skill at the end of the user's list (position = max+1).
     * Caller is responsible for the 10-skill cap check (handler enforces it
     * via countSkills before calling).
     */
    addSkill(userId: string, name: string): Promise<UserSkillEntity>

    /**
     * Remove a skill. Throws SkillNotFoundException if the skill doesn't
     * exist OR doesn't belong to the user (we don't distinguish to avoid
     * leaking the existence of other users' skills).
     */
    removeSkill(userId: string, skillId: string): Promise<void>

    countSkills(userId: string): Promise<number>

    // ────────────────────────────────────────────────────────────────────
    // Portfolio (Feature 02)
    // ────────────────────────────────────────────────────────────────────

    addPortfolioItem(data: {
        userId: string
        imageKey: string
        width: number
        height: number
    }): Promise<PortfolioItemEntity>

    /**
     * Remove a portfolio item. Returns the deleted entity so the calling
     * handler can publish a PortfolioItemDeletedEvent with the imageKey
     * (for the S3 cleanup handler to consume).
     * Throws PortfolioItemNotFoundException on miss.
     */
    removePortfolioItem(userId: string, itemId: string): Promise<PortfolioItemEntity>

    countPortfolioItems(userId: string): Promise<number>
}

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort')
