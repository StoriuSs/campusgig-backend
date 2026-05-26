import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import {
    UserRepositoryPort,
    UserEntity,
    UserSkillEntity,
    PortfolioItemEntity,
    UsernameTakenException,
    SkillNotFoundException,
    PortfolioItemNotFoundException
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
        return {
            user: UserMapper.toDomain(row),
            skills: row.skills.map(UserSkillMapper.toDomain),
            portfolioItems: row.portfolioItems.map(PortfolioItemMapper.toDomain)
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
        return {
            user: UserMapper.toDomain(row),
            skills: row.skills.map(UserSkillMapper.toDomain),
            portfolioItems: row.portfolioItems.map(PortfolioItemMapper.toDomain)
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
