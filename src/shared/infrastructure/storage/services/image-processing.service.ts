import { Injectable, Logger, HttpStatus } from '@nestjs/common'
import sharp from 'sharp'
import { CustomException } from '@/shared/presentation/exceptions'
import { ERROR_CODES, ERROR_TYPES } from '@/shared/constants'
import { MESSAGES } from '@/shared/constants'

export interface ProcessedImage {
    buffer: Buffer
    width: number
    height: number
    format: string
    size: number
}

export interface ImageProcessingOptions {
    /** Convert to WebP format for better compression */
    convertToWebp?: boolean
    /** Quality for lossy formats (1-100) */
    quality?: number
    /** Strip EXIF and metadata for privacy */
    stripMetadata?: boolean
    /** Maximum width - will resize if larger */
    maxWidth?: number
    /** Maximum height - will resize if larger */
    maxHeight?: number
}

const DEFAULT_OPTIONS: ImageProcessingOptions = {
    convertToWebp: true,
    quality: 80,
    stripMetadata: true,
    maxWidth: 2048,
    maxHeight: 2048
}

@Injectable()
export class ImageProcessingService {
    private readonly logger = new Logger(ImageProcessingService.name)

    /**
     * Process an image: resize if too large, convert to WebP, strip metadata
     */
    async processImage(input: Buffer, options: ImageProcessingOptions = {}): Promise<ProcessedImage> {
        const opts = { ...DEFAULT_OPTIONS, ...options }

        try {
            let pipeline = sharp(input)
            const metadata = await sharp(input).metadata()

            // Auto-rotate based on EXIF, then strip metadata
            if (opts.stripMetadata) {
                pipeline = pipeline.rotate()
            }

            // Resize if image exceeds max dimensions
            if (opts.maxWidth || opts.maxHeight) {
                const needsResize =
                    (opts.maxWidth && metadata.width && metadata.width > opts.maxWidth) ||
                    (opts.maxHeight && metadata.height && metadata.height > opts.maxHeight)

                if (needsResize) {
                    pipeline = pipeline.resize({
                        width: opts.maxWidth,
                        height: opts.maxHeight,
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                }
            }

            // Convert to WebP or optimize original format
            if (opts.convertToWebp) {
                pipeline = pipeline.webp({ quality: opts.quality })
            } else if (metadata.format === 'jpeg') {
                pipeline = pipeline.jpeg({ quality: opts.quality, mozjpeg: true })
            } else if (metadata.format === 'png') {
                pipeline = pipeline.png({ compressionLevel: 9 })
            }

            const buffer = await pipeline.toBuffer()
            const outputMetadata = await sharp(buffer).metadata()

            return {
                buffer,
                width: outputMetadata.width || 0,
                height: outputMetadata.height || 0,
                format: outputMetadata.format || 'webp',
                size: buffer.length
            }
        } catch (error) {
            this.logger.error('Image processing failed', { error: error.message })
            throw new CustomException({
                code: ERROR_CODES.IMAGE_PROCESSING_FAILED,
                type: ERROR_TYPES.IMAGE_PROCESSING_FAILED,
                message: MESSAGES.UPLOAD.IMAGE_PROCESSING_FAILED,
                status: HttpStatus.UNPROCESSABLE_ENTITY
            })
        }
    }

    /**
     * Process avatar: resize to max 512x512, convert to WebP
     */
    async processAvatar(input: Buffer): Promise<ProcessedImage> {
        return this.processImage(input, {
            convertToWebp: true,
            quality: 85,
            stripMetadata: true,
            maxWidth: 512,
            maxHeight: 512
        })
    }

    /**
     * Validate if buffer is a valid image
     */
    async isValidImage(input: Buffer): Promise<boolean> {
        try {
            const metadata = await sharp(input).metadata()
            return !!metadata.format && !!metadata.width && !!metadata.height
        } catch {
            return false
        }
    }

    /**
     * Get image metadata
     */
    async getMetadata(input: Buffer): Promise<sharp.Metadata> {
        return sharp(input).metadata()
    }
}
