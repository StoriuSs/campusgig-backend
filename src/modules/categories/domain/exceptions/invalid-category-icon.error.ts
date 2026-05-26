export class InvalidCategoryIconException extends Error {
    constructor(public readonly icon: string) {
        super(`Icon "${icon}" is not in the allowed set. See ALLOWED_CATEGORY_ICONS.`)
        this.name = 'InvalidCategoryIconException'
    }
}
