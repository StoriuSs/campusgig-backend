import { UserEntity, UserSkillEntity, PortfolioItemEntity } from '@/modules/users/domain'
import { User, UserSkill, PortfolioItem } from '@/generated/prisma/client'

/**
 * User Mapper
 *
 * Converts between the Prisma-generated User type and the domain UserEntity.
 * This is the ONLY file that knows about both the domain entity and the ORM type.
 */
export class UserMapper {
    /**
     * Map Prisma User → Domain UserEntity
     */
    static toDomain(prismaUser: User): UserEntity {
        return new UserEntity({
            id: prismaUser.id,
            keycloakId: prismaUser.keycloakId,
            username: prismaUser.username,
            email: prismaUser.email,
            displayName: prismaUser.displayName,
            avatarUrl: prismaUser.avatarUrl,
            bio: prismaUser.bio,
            hasSetUsername: prismaUser.hasSetUsername,
            location: prismaUser.location,
            roleLine: prismaUser.roleLine,
            languages: prismaUser.languages,
            endorsedAt: prismaUser.endorsedAt,
            endorsedBy: prismaUser.endorsedBy,
            adminNote: prismaUser.adminNote,
            isAdmin: prismaUser.isAdmin,
            reviewCount: prismaUser.reviewCount,
            ratingSumHalfStars: prismaUser.ratingSumHalfStars,
            emailNotificationsEnabled: prismaUser.emailNotificationsEnabled,
            emailOrders: prismaUser.emailOrders,
            emailDisputes: prismaUser.emailDisputes,
            emailGigs: prismaUser.emailGigs,
            createdAt: prismaUser.createdAt,
            updatedAt: prismaUser.updatedAt,
            deletedAt: prismaUser.deletedAt,
            deletedBy: prismaUser.deletedBy
        })
    }

    /**
     * Map Domain UserEntity → Prisma-compatible data for create/update
     * Only includes mutable fields (excludes id, createdAt, etc.)
     */
    static toPersistence(entity: Partial<UserEntity>): Partial<User> {
        const data: Record<string, unknown> = {}

        if (entity.username !== undefined) data.username = entity.username
        if (entity.email !== undefined) data.email = entity.email
        if (entity.displayName !== undefined) data.displayName = entity.displayName
        if (entity.avatarUrl !== undefined) data.avatarUrl = entity.avatarUrl
        if (entity.bio !== undefined) data.bio = entity.bio
        if (entity.hasSetUsername !== undefined) data.hasSetUsername = entity.hasSetUsername
        if (entity.location !== undefined) data.location = entity.location
        if (entity.roleLine !== undefined) data.roleLine = entity.roleLine
        if (entity.languages !== undefined) data.languages = entity.languages
        if (entity.endorsedAt !== undefined) data.endorsedAt = entity.endorsedAt
        if (entity.endorsedBy !== undefined) data.endorsedBy = entity.endorsedBy
        if (entity.adminNote !== undefined) data.adminNote = entity.adminNote
        if (entity.isAdmin !== undefined) data.isAdmin = entity.isAdmin
        if (entity.emailNotificationsEnabled !== undefined)
            data.emailNotificationsEnabled = entity.emailNotificationsEnabled
        if (entity.emailOrders !== undefined) data.emailOrders = entity.emailOrders
        if (entity.emailDisputes !== undefined) data.emailDisputes = entity.emailDisputes
        if (entity.emailGigs !== undefined) data.emailGigs = entity.emailGigs
        if (entity.deletedAt !== undefined) data.deletedAt = entity.deletedAt
        if (entity.deletedBy !== undefined) data.deletedBy = entity.deletedBy

        return data as Partial<User>
    }
}

/**
 * UserSkill Mapper — owned by user.mapper.ts because UserSkill is a value
 * object of the User aggregate (not its own aggregate root).
 */
export class UserSkillMapper {
    static toDomain(row: UserSkill): UserSkillEntity {
        return new UserSkillEntity({
            id: row.id,
            userId: row.userId,
            name: row.name,
            position: row.position,
            createdAt: row.createdAt
        })
    }
}

/**
 * PortfolioItem Mapper — owned by user.mapper.ts for the same reason.
 */
export class PortfolioItemMapper {
    static toDomain(row: PortfolioItem): PortfolioItemEntity {
        return new PortfolioItemEntity({
            id: row.id,
            userId: row.userId,
            imageKey: row.imageKey,
            width: row.width,
            height: row.height,
            position: row.position,
            createdAt: row.createdAt
        })
    }
}
