/**
 * Domain Exception: Maximum Skills Reached
 *
 * Thrown when a user tries to add an 11th skill. The 10-skill cap is a
 * product-level constraint, not a domain invariant — but we surface it as a
 * domain exception so the presentation layer (filter) can translate it into
 * a consistent 4xx response.
 */
export class MaxSkillsReachedException extends Error {
    constructor() {
        super('Maximum of 10 skills allowed per user.')
        this.name = 'MaxSkillsReachedException'
    }
}
