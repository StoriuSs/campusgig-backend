import { registerAs } from '@nestjs/config'
import { parseIntSafe } from '@/shared/utils'

export default registerAs('upload', () => ({
    storageType: process.env.STORAGE_TYPE || 'local',
    maxFileSize: parseIntSafe(process.env.MAX_FILE_SIZE, 5242880), // 5MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    local: {
        uploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads'
    },
    s3: {
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET || '',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
}))
