import { Injectable, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand
} from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { CustomException } from '@/shared/presentation/exceptions'
import { ERROR_CODES, ERROR_TYPES } from '@/shared/constants'
import { MESSAGES } from '@/shared/constants'
import { IStorageService, UploadedFile, UploadOptions } from '../interfaces/storage.interface'

@Injectable()
export class S3StorageService implements IStorageService {
    private s3Client: S3Client
    private bucket: string
    private region: string
    private maxFileSize: number
    private allowedFileTypes: string[]

    constructor(private readonly configService: ConfigService) {
        this.region = this.configService.get<string>('upload.s3.region')!
        this.bucket = this.configService.get<string>('upload.s3.bucket')!
        this.maxFileSize = this.configService.get<number>('upload.maxFileSize') || 5 * 1024 * 1024
        this.allowedFileTypes = this.configService.get<string[]>('upload.allowedFileTypes') || [
            'image/jpeg',
            'image/png',
            'image/jpg',
            'image/webp'
        ]

        this.s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: this.configService.get<string>('upload.s3.accessKeyId')!,
                secretAccessKey: this.configService.get<string>('upload.s3.secretAccessKey')!
            }
        })
    }

    async uploadFile(file: Express.Multer.File, options?: UploadOptions): Promise<UploadedFile> {
        const maxSize = options?.maxFileSize || this.maxFileSize
        const allowedTypes = options?.allowedMimeTypes || this.allowedFileTypes
        const subDir = options?.subDirectory || ''
        const prefix = options?.filenamePrefix || ''

        // Validate file size
        if (file.size > maxSize) {
            throw new CustomException({
                code: ERROR_CODES.UPLOAD_FILE_TOO_LARGE,
                type: ERROR_TYPES.UPLOAD_FILE_TOO_LARGE,
                message: MESSAGES.UPLOAD.FILE_TOO_LARGE,
                status: HttpStatus.PAYLOAD_TOO_LARGE
            })
        }

        // Validate file type
        if (!allowedTypes.includes(file.mimetype)) {
            throw new CustomException({
                code: ERROR_CODES.UPLOAD_INVALID_TYPE,
                type: ERROR_TYPES.UPLOAD_INVALID_TYPE,
                message: MESSAGES.UPLOAD.INVALID_FILE_TYPE,
                status: HttpStatus.UNSUPPORTED_MEDIA_TYPE
            })
        }

        // Generate unique filename
        const fileExtension = file.originalname.split('.').pop()
        const uniqueSuffix = `${Date.now()}-${uuidv4().split('-')[0]}`
        const filename = prefix ? `${prefix}-${uniqueSuffix}.${fileExtension}` : `${uniqueSuffix}.${fileExtension}`

        // Build S3 key (path)
        const s3Key = subDir ? `${subDir}/${filename}` : filename

        try {
            // Get file buffer
            const fileBuffer = file.buffer || (await this.readFileFromPath(file.path))

            // Upload to S3
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: file.mimetype
            })

            await this.s3Client.send(command)

            // Build public URL
            const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`

            return {
                filename,
                originalName: file.originalname,
                path: s3Key,
                size: file.size,
                mimetype: file.mimetype,
                url,
                key: s3Key
            }
        } catch (error) {
            throw new CustomException({
                code: ERROR_CODES.UPLOAD_FAILED,
                type: ERROR_TYPES.UPLOAD_FAILED,
                message: `Failed to upload file to S3: ${error.message}`,
                status: HttpStatus.INTERNAL_SERVER_ERROR
            })
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        try {
            // Handle both full URL and key path
            const s3Key = this.extractS3Key(filePath)

            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: s3Key
            })

            await this.s3Client.send(command)
        } catch (error) {
            throw new CustomException({
                code: ERROR_CODES.UPLOAD_DELETE_FAILED,
                type: ERROR_TYPES.UPLOAD_DELETE_FAILED,
                message: `Failed to delete file from S3: ${error.message}`,
                status: HttpStatus.INTERNAL_SERVER_ERROR
            })
        }
    }

    async getFile(filePath: string): Promise<Buffer> {
        try {
            const s3Key = this.extractS3Key(filePath)

            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: s3Key
            })

            const response = await this.s3Client.send(command)
            const stream = response.Body as NodeJS.ReadableStream

            return this.streamToBuffer(stream)
        } catch {
            throw new CustomException({
                code: ERROR_CODES.UPLOAD_FILE_NOT_FOUND,
                type: ERROR_TYPES.UPLOAD_FILE_NOT_FOUND,
                message: `File not found in S3: ${filePath}`,
                status: HttpStatus.NOT_FOUND
            })
        }
    }

    /**
     * Extract S3 key from full URL or path
     * Handles:
     * - Full URL: https://bucket.s3.region.amazonaws.com/path/file.jpg → path/file.jpg
     * - Key path: path/file.jpg → path/file.jpg
     */
    private extractS3Key(filePath: string): string {
        if (filePath.includes('amazonaws.com/')) {
            return filePath.split('amazonaws.com/')[1]
        }
        return filePath
    }

    private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk))
        }
        return Buffer.concat(chunks)
    }

    private async readFileFromPath(filePath: string): Promise<Buffer> {
        const { promises: fs } = await import('fs')
        return fs.readFile(filePath)
    }

    async uploadBuffer(
        buffer: Buffer,
        filename: string,
        mimetype: string,
        options?: Omit<UploadOptions, 'allowedMimeTypes' | 'maxFileSize'>
    ): Promise<UploadedFile> {
        const subDir = options?.subDirectory || ''
        const prefix = options?.filenamePrefix || ''

        // Generate unique filename
        const fileExtension = filename.split('.').pop() || 'bin'
        const uniqueSuffix = `${Date.now()}-${uuidv4().split('-')[0]}`
        const finalFilename = prefix ? `${prefix}-${uniqueSuffix}.${fileExtension}` : `${uniqueSuffix}.${fileExtension}`

        // Build S3 key
        const s3Key = subDir ? `${subDir}/${finalFilename}` : finalFilename

        try {
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: s3Key,
                Body: buffer,
                ContentType: mimetype
            })

            await this.s3Client.send(command)

            const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`

            return {
                filename: finalFilename,
                originalName: filename,
                path: s3Key,
                size: buffer.length,
                mimetype,
                url,
                key: s3Key
            }
        } catch (error) {
            throw new CustomException({
                code: ERROR_CODES.UPLOAD_FAILED,
                type: ERROR_TYPES.UPLOAD_FAILED,
                message: `Failed to upload buffer to S3: ${error.message}`,
                status: HttpStatus.INTERNAL_SERVER_ERROR
            })
        }
    }

    async fileExists(filePath: string): Promise<boolean> {
        try {
            const s3Key = this.extractS3Key(filePath)
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: s3Key
            })
            await this.s3Client.send(command)
            return true
        } catch {
            return false
        }
    }

    /**
     * Generate the public URL for a file
     */
    getPublicUrl(s3Key: string): string {
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${this.extractS3Key(s3Key)}`
    }
}
