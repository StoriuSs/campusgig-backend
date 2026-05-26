export class DuplicateCategoryNameException extends Error {
    constructor(public readonly name: string) {
        super(`A category named "${name}" already exists (case-insensitive).`)
        this.name = 'DuplicateCategoryNameException'
    }
}
