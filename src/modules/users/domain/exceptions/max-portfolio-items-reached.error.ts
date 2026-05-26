/**
 * Domain Exception: Maximum Portfolio Items Reached
 *
 * Thrown when a user tries to add a 10th portfolio item. The 9-item cap is
 * a product-level constraint surfaced as a domain exception for consistent
 * 4xx translation in the presentation layer.
 */
export class MaxPortfolioItemsReachedException extends Error {
    constructor() {
        super('Maximum of 9 portfolio items allowed per user.')
        this.name = 'MaxPortfolioItemsReachedException'
    }
}
