/**
 * Storage Port (Application Layer)
 *
 * Defines what the application needs from a file storage system.
 * No knowledge of S3, local filesystem, or any specific storage backend.
 */

export interface UploadedFileResult {
    key: string // Relative storage key
    path: string // Full path to the file
    width?: number
    height?: number
}

export interface SignedReadUrlOptions {
    /** Seconds the URL stays valid. Default: 3600 (1 hour). S3 v4 max: 7 days. */
    expiresIn?: number
    /**
     * Override Content-Disposition on the response (e.g.
     * `attachment; filename="x.pdf"`) to force download. Optional.
     */
    responseContentDisposition?: string
}

export interface StoragePort {
    /**
     * Upload an avatar image. Handles processing (resize, format conversion) internally.
     */
    uploadAvatar(file: Buffer, originalName: string, userId: string): Promise<UploadedFileResult>

    /**
     * Upload a portfolio image. Handles processing (resize to max 1600×1200,
     * WebP conversion, EXIF strip) internally. Same shape as uploadAvatar.
     */
    uploadPortfolioItem(file: Buffer, originalName: string, userId: string): Promise<UploadedFileResult>

    /**
     * Delete a file by its relative key.
     */
    deleteFile(filePath: string): Promise<void>

    /**
     * Get the public URL path for a stored file (relative to base URL).
     * Only safe for public objects. Use `getSignedReadUrl` for private ones.
     */
    getPublicUrl(key: string): string

    /**
     * Get a time-limited signed URL for reading a private object.
     * Resolves to the same path `getPublicUrl` would for local storage
     * (dev only). For S3, returns a presigned URL with v4 signature.
     */
    getSignedReadUrl(key: string, options?: SignedReadUrlOptions): Promise<string>
}

export const STORAGE_PORT = Symbol('StoragePort')
