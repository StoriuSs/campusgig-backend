/**
 * Domain Exception: Avatar Required
 *
 * Thrown when an avatar upload is attempted without providing a file.
 */
export class AvatarRequiredException extends Error {
    constructor() {
        super('Avatar file is required')
        this.name = 'AvatarRequiredException'
    }
}
