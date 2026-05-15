/**
 * Domain Exceptions
 *
 * These are pure domain-level errors that have NO knowledge of HTTP, Prisma, or any
 * specific framework. They are thrown by the repository/infrastructure layer and caught
 * by the service/application layer, which then translates them into HTTP-specific
 * exceptions (like CustomException) for the controller.
 *
 * This keeps the service layer completely database-agnostic.
 */

/**
 * Thrown when a unique constraint is violated (e.g., duplicate username).
 * The repository catches ORM-specific errors (Prisma P2002, TypeORM 23505, etc.)
 * and throws this generic domain exception instead.
 */
export class UniqueConstraintException extends Error {
    constructor(public readonly field: string) {
        super(`Unique constraint violation on field: ${field}`)
        this.name = 'UniqueConstraintException'
    }
}

/**
 * Thrown when an entity is not found in the data store.
 */
export class EntityNotFoundException extends Error {
    constructor(
        public readonly entity: string,
        public readonly id: string
    ) {
        super(`${entity} with id '${id}' not found`)
        this.name = 'EntityNotFoundException'
    }
}
