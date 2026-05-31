import { UserEntity } from '../entities/user.entity'
import { UserSkillEntity } from '../entities/user-skill.entity'
import { PortfolioItemEntity } from '../entities/portfolio-item.entity'

// Same shape regardless of which lookup populated it.
export interface UserWithRelations {
    user: UserEntity
    skills: UserSkillEntity[]
    portfolioItems: PortfolioItemEntity[]
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
