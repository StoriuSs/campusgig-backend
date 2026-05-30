export const DELIVERY_STORAGE_PORT = 'DELIVERY_STORAGE_PORT'

// Parallels MESSAGE_ATTACHMENT_STORAGE_PORT — same S3 bucket, different
// prefix (deliveries/{orderId}/...). Domain layer never touches the SDK.
export interface DeliveryStoragePort {
    upload(input: {
        orderId: string
        filename: string
        mime: string
        body: Buffer
    }): Promise<{ key: string; size: number }>

    presignGetUrl(key: string, ttlSeconds: number, downloadFilename?: string): Promise<string>

    delete(key: string): Promise<void>
}
