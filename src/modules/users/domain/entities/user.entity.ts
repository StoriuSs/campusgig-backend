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
    // We never store an explicit "not endorsed" state per CLAUDE.md.
    endorsedAt: Date | null
    endorsedBy: string | null

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
