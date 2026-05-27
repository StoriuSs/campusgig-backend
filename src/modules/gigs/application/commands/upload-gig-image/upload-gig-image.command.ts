export class UploadGigImageCommand {
    constructor(
        public readonly fileBuffer: Buffer,
        public readonly originalName: string,
        public readonly uploaderId: string
    ) {}
}
