export class UploadEvidenceFileCommand {
    constructor(
        public readonly orderId: string,
        public readonly viewerId: string,
        public readonly filename: string,
        public readonly mime: string,
        public readonly body: Buffer
    ) {}
}
