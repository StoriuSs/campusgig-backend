export const MESSAGE_ATTACHMENT_STORAGE_PORT = 'MESSAGE_ATTACHMENT_STORAGE_PORT'

// Parallels GIG_STORAGE_PORT — same S3 bucket, different key prefix
// ("messages/..."). Domain/application code never touches the S3 SDK directly.
export interface MessageAttachmentStoragePort {
    upload(input: {
        threadId: string
        filename: string
        mime: string
        body: Buffer
    }): Promise<{ key: string; size: number }>

    // TTL in seconds. Frontend re-fetches when expired. When
    // `downloadFilename` is provided, the presigned URL carries a
    // Content-Disposition: attachment header override so the browser
    // downloads instead of inlining.
    presignGetUrl(key: string, ttlSeconds: number, downloadFilename?: string): Promise<string>

    delete(key: string): Promise<void>
}
