export class UnsupportedDeliveryFileTypeException extends Error {
    constructor(public readonly mime: string) {
        super(`Unsupported delivery file type: ${mime}`)
        this.name = 'UnsupportedDeliveryFileTypeException'
    }
}
