export class AttachmentTooLargeException extends Error {
    constructor(
        public readonly size: number,
        public readonly max: number
    ) {
        super(`Attachment too large: ${size} bytes, max ${max} bytes`)
        this.name = 'AttachmentTooLargeException'
    }
}
