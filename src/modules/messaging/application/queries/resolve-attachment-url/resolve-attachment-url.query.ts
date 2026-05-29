export class ResolveAttachmentUrlQuery {
    constructor(
        public readonly viewerId: string,
        public readonly attachmentId: string,
        // When true, the presigned URL is built with Content-Disposition:
        // attachment so the browser downloads instead of opening inline.
        public readonly forDownload: boolean = false
    ) {}
}
