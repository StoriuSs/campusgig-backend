/**
 * Domain Exception: Skill Not Found
 *
 * Thrown when attempting to operate on a skill that doesn't exist OR that
 * doesn't belong to the requesting user. Conflating the two (instead of
 * returning a separate "forbidden") avoids leaking the existence of skills
 * belonging to other users.
 */
export class SkillNotFoundException extends Error {
    constructor(public readonly skillId: string) {
        super(`Skill not found: ${skillId}`)
        this.name = 'SkillNotFoundException'
    }
}
