export class UnsupportedAttachmentTypeException extends Error {
    constructor(public readonly mime: string) {
        super(`Unsupported attachment type: ${mime}`)
        this.name = 'UnsupportedAttachmentTypeException'
    }
}
