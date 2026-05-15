/**
 * Domain Exception: Username Already Set
 *
 * Thrown when a user attempts to set their username a second time.
 * Username can only be set once (first-time action).
 */
export class UsernameAlreadySetException extends Error {
    constructor() {
        super('Username has already been set and cannot be changed')
        this.name = 'UsernameAlreadySetException'
    }
}
