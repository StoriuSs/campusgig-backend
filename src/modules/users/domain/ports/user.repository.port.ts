import { UserEntity } from '../entities/user.entity'

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
}

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort')
