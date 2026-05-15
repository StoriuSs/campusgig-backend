/**
 * Domain Exception: Username Already Taken
 *
 * Thrown when attempting to set a username that is already in use.
 * The repository adapter translates ORM-specific constraint violations into this.
 */
export class UsernameTakenException extends Error {
    constructor(public readonly username: string) {
        super(`Username already taken: ${username}`)
        this.name = 'UsernameTakenException'
    }
}
