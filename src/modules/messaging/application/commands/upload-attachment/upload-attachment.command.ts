export class UploadAttachmentCommand {
    constructor(
        public readonly viewerId: string,
        public readonly threadId: string,
        public readonly filename: string,
        public readonly mime: string,
        public readonly body: Buffer
    ) {}
}
