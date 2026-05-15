import { ImageProcessingOptions } from '../services/image-processing.service'

export interface UploadedFile {
    filename: string
    originalName: string
    path: string
    size: number
    mimetype: string
    url: string
    /** The relative storage key/path used to fetch or delete the file (e.g., 'avatars/file.webp') */
    key: string
    /** Image dimensions (only for processed images) */
    width?: number
    height?: number
}

export interface UploadOptions {
    /** Subdirectory within the upload folder (e.g., 'avatars', 'documents') */
    subDirectory?: string
    /** Allowed MIME types for this upload */
    allowedMimeTypes?: string[]
    /** Maximum file size in bytes */
    maxFileSize?: number
    /** Prefix for the generated filename */
    filenamePrefix?: string
    /** Image processing options (only applied to images) */
    imageProcessing?: ImageProcessingOptions
}

export interface IStorageService {
    uploadFile(file: Express.Multer.File, options?: UploadOptions): Promise<UploadedFile>
    uploadBuffer(buffer: Buffer, filename: string, mimetype: string, options?: UploadOptions): Promise<UploadedFile>
    deleteFile(filePath: string): Promise<void>
    getFile(filePath: string): Promise<Buffer>
    fileExists(filePath: string): Promise<boolean>
    getPublicUrl(filePath: string): string
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE'
