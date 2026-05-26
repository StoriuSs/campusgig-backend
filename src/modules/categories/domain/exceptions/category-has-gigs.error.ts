/**
 * Thrown by `DeleteCategoryHandler` when the caller tries to delete a category
 * that has ≥1 gigs, without providing a `reassignTo` target.
 *
 * In Feature 03 this never fires because no gigs exist yet. Wired up now so
 * Feature 04 (Gig creation) doesn't have to retrofit the safeguard.
 */
export class CategoryHasGigsException extends Error {
    constructor(
        public readonly categoryId: string,
        public readonly gigCount: number
    ) {
        super(`Category ${categoryId} has ${gigCount} gigs; reassignTo is required.`)
        this.name = 'CategoryHasGigsException'
    }
}
