import { UserMapper } from './user.mapper'
import { UserEntity } from '@/modules/users/domain'
import { User } from '@/generated/prisma/client'

describe('UserMapper', () => {
    const now = new Date('2026-01-15T12:00:00Z')

    // A complete Prisma User object (simulating what comes from the database)
    const fullPrismaUser: User = {
        id: 'user-123',
        keycloakId: 'kc-456',
        username: 'johndoe',
        email: 'john@example.com',
        displayName: 'John Doe',
        avatarUrl: 'uploads/avatars/user-123.webp',
        bio: 'Hello world',
        hasSetUsername: true,
        location: null,
        roleLine: null,
        languages: null,
        endorsedAt: null,
        endorsedBy: null,
        isAdmin: false,
        reviewCount: 0,
        ratingSumHalfStars: 0,
        walletBalance: 0,
        escrowBalance: 0,
        pendingWithdrawalBalance: 0,
        bankName: null,
        bankAccountNumber: null,
        bankAccountHolder: null,
        lastSeenAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deletedBy: null
    }

    describe('toDomain', () => {
        it('should map all fields from Prisma User to UserEntity', () => {
            const entity = UserMapper.toDomain(fullPrismaUser)

            expect(entity).toBeInstanceOf(UserEntity)
            expect(entity.id).toBe('user-123')
            expect(entity.keycloakId).toBe('kc-456')
            expect(entity.username).toBe('johndoe')
            expect(entity.email).toBe('john@example.com')
            expect(entity.displayName).toBe('John Doe')
            expect(entity.avatarUrl).toBe('uploads/avatars/user-123.webp')
            expect(entity.bio).toBe('Hello world')
            expect(entity.hasSetUsername).toBe(true)
            expect(entity.createdAt).toEqual(now)
            expect(entity.updatedAt).toEqual(now)
            expect(entity.deletedAt).toBeNull()
            expect(entity.deletedBy).toBeNull()
        })

        it('should correctly map nullable fields when they are null', () => {
            const minimalUser: User = {
                ...fullPrismaUser,
                username: null,
                email: null,
                displayName: null,
                avatarUrl: null,
                bio: null,
                hasSetUsername: false
            }

            const entity = UserMapper.toDomain(minimalUser)

            expect(entity.username).toBeNull()
            expect(entity.email).toBeNull()
            expect(entity.displayName).toBeNull()
            expect(entity.avatarUrl).toBeNull()
            expect(entity.bio).toBeNull()
            expect(entity.hasSetUsername).toBe(false)
        })

        it('should map soft-deleted user with deletedAt and deletedBy', () => {
            const deletedUser: User = {
                ...fullPrismaUser,
                deletedAt: now,
                deletedBy: 'user-123'
            }

            const entity = UserMapper.toDomain(deletedUser)

            expect(entity.deletedAt).toEqual(now)
            expect(entity.deletedBy).toBe('user-123')
            expect(entity.isDeleted).toBe(true)
        })
    })

    describe('toPersistence', () => {
        it('should only include explicitly set fields', () => {
            const result = UserMapper.toPersistence({
                username: 'newname',
                hasSetUsername: true
            })

            expect(result).toEqual({
                username: 'newname',
                hasSetUsername: true
            })
            // Must NOT include fields that weren't passed
            expect(result).not.toHaveProperty('email')
            expect(result).not.toHaveProperty('displayName')
            expect(result).not.toHaveProperty('bio')
        })

        it('should include null values when explicitly set (for clearing fields)', () => {
            const result = UserMapper.toPersistence({
                avatarUrl: null,
                bio: null
            })

            expect(result).toEqual({
                avatarUrl: null,
                bio: null
            })
        })

        it('should return empty object when no fields are provided', () => {
            const result = UserMapper.toPersistence({})

            expect(result).toEqual({})
        })

        it('should map all mutable fields correctly', () => {
            const deletedAt = new Date()
            const result = UserMapper.toPersistence({
                username: 'user',
                email: 'e@mail.com',
                displayName: 'Display',
                avatarUrl: 'url',
                bio: 'bio text',
                hasSetUsername: true,
                deletedAt,
                deletedBy: 'admin-1'
            })

            expect(result).toEqual({
                username: 'user',
                email: 'e@mail.com',
                displayName: 'Display',
                avatarUrl: 'url',
                bio: 'bio text',
                hasSetUsername: true,
                deletedAt,
                deletedBy: 'admin-1'
            })
        })
    })
})
