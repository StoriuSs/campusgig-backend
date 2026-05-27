export class CategoryNotFoundForGigException extends Error {
    constructor(public readonly categoryId: string) {
        super(`Category not found: ${categoryId}`)
        this.name = 'CategoryNotFoundForGigException'
    }
}
