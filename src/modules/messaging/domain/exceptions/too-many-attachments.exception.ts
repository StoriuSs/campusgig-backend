export class TooManyAttachmentsException extends Error {
    constructor(
        public readonly count: number,
        public readonly max: number
    ) {
        super(`Too many attachments: ${count}, max ${max} per message`)
        this.name = 'TooManyAttachmentsException'
    }
}
