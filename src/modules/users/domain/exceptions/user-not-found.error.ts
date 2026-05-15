/**
 * Domain Exception: User Not Found
 *
 * Thrown when a user lookup returns no result.
 * Pure domain error — no HTTP status, no framework dependency.
 */
export class UserNotFoundException extends Error {
    constructor(public readonly identifier: string) {
        super(`User not found: ${identifier}`)
        this.name = 'UserNotFoundException'
    }
}
