export class TooManyDeliveryFilesException extends Error {
    constructor(
        public readonly count: number,
        public readonly max: number
    ) {
        super(`Too many delivery files: ${count}, max ${max}`)
        this.name = 'TooManyDeliveryFilesException'
    }
}
