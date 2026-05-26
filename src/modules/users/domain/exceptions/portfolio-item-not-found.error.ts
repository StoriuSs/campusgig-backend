/**
 * Domain Exception: Portfolio Item Not Found
 *
 * Thrown when attempting to operate on a portfolio item that doesn't exist OR
 * doesn't belong to the requesting user. Same rationale as SkillNotFoundException.
 */
export class PortfolioItemNotFoundException extends Error {
    constructor(public readonly itemId: string) {
        super(`Portfolio item not found: ${itemId}`)
        this.name = 'PortfolioItemNotFoundException'
    }
}
