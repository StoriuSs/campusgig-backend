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

export interface StoragePort {
    /**
     * Upload an avatar image. Handles processing (resize, format conversion) internally.
     */
    uploadAvatar(file: Buffer, originalName: string, userId: string): Promise<UploadedFileResult>

    /**
     * Delete a file by its relative key.
     */
    deleteFile(filePath: string): Promise<void>

    /**
     * Get the public URL path for a stored file (relative to base URL).
     */
    getPublicUrl(key: string): string
}

export const STORAGE_PORT = Symbol('StoragePort')
