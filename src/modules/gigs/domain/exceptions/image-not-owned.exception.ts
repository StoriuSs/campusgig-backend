export class ImageNotOwnedException extends Error {
    constructor(public readonly imageId: string) {
        super(`Image ${imageId} is not owned by the caller or is not available for attachment.`)
        this.name = 'ImageNotOwnedException'
    }
}
