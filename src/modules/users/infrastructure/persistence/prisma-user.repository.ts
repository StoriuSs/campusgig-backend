import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import { UserRepositoryPort } from '@/modules/users/domain'
import { UserEntity } from '@/modules/users/domain'
import { UsernameTakenException } from '@/modules/users/domain'
import { UserMapper } from '../mappers/user.mapper'

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
}
