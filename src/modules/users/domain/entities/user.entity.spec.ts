import { UserEntity } from './user.entity'

describe('UserEntity', () => {
    describe('constructor defaults', () => {
        it('should set required fields from props', () => {
            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1'
            })

            expect(entity.id).toBe('user-1')
            expect(entity.keycloakId).toBe('kc-1')
        })

        it('should default optional string fields to null', () => {
            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1'
            })

            expect(entity.username).toBeNull()
            expect(entity.email).toBeNull()
            expect(entity.displayName).toBeNull()
            expect(entity.avatarUrl).toBeNull()
            expect(entity.bio).toBeNull()
        })

        it('should default hasSetUsername to false', () => {
            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1'
            })

            expect(entity.hasSetUsername).toBe(false)
        })

        it('should default deletedAt and deletedBy to null', () => {
            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1'
            })

            expect(entity.deletedAt).toBeNull()
            expect(entity.deletedBy).toBeNull()
        })

        it('should default createdAt and updatedAt to a Date', () => {
            const before = new Date()
            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1'
            })
            const after = new Date()

            expect(entity.createdAt).toBeInstanceOf(Date)
            expect(entity.updatedAt).toBeInstanceOf(Date)
            expect(entity.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
            expect(entity.createdAt.getTime()).toBeLessThanOrEqual(after.getTime())
        })

        it('should accept all optional fields when provided', () => {
            const now = new Date('2026-01-01T00:00:00Z')

            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1',
                username: 'johndoe',
                email: 'john@example.com',
                displayName: 'John',
                avatarUrl: 'avatar.webp',
                bio: 'Hello',
                hasSetUsername: true,
                createdAt: now,
                updatedAt: now,
                deletedAt: now,
                deletedBy: 'admin'
            })

            expect(entity.username).toBe('johndoe')
            expect(entity.email).toBe('john@example.com')
            expect(entity.displayName).toBe('John')
            expect(entity.avatarUrl).toBe('avatar.webp')
            expect(entity.bio).toBe('Hello')
            expect(entity.hasSetUsername).toBe(true)
            expect(entity.createdAt).toEqual(now)
            expect(entity.updatedAt).toEqual(now)
            expect(entity.deletedAt).toEqual(now)
            expect(entity.deletedBy).toBe('admin')
        })
    })

    describe('isDeleted', () => {
        it('should return false when deletedAt is null', () => {
            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1',
                deletedAt: null
            })

            expect(entity.isDeleted).toBe(false)
        })

        it('should return true when deletedAt is set', () => {
            const entity = new UserEntity({
                id: 'user-1',
                keycloakId: 'kc-1',
                deletedAt: new Date()
            })

            expect(entity.isDeleted).toBe(true)
        })
    })
})
