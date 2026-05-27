/**
 * Storage Port for the Gigs module. Mirrors the shape of the users-module
 * StoragePort but scoped to gig images.
 */

export interface GigImageUploadResult {
    key: string
    width: number
    height: number
}

export interface GigStoragePort {
    /** Upload a gig image. Returns the storage key + dimensions after sharp processing. */
    uploadGigImage(file: Buffer, originalName: string, uploaderId: string): Promise<GigImageUploadResult>

    /** Delete a stored object by key. */
    deleteFile(key: string): Promise<void>

    /** Resolve a key to a presigned read URL. */
    getSignedReadUrl(key: string): Promise<string>
}

export const GIG_STORAGE_PORT = Symbol('GigStoragePort')
