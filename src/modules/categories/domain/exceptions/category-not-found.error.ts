export class CategoryNotFoundException extends Error {
    constructor(public readonly identifier: string) {
        super(`Category not found: ${identifier}`)
        this.name = 'CategoryNotFoundException'
    }
}
