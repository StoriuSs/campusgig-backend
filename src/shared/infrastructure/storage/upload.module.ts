import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { UploadService } from './upload.service'
import { LocalStorageService } from './services/local-storage.service'
import { S3StorageService } from './services/s3-storage.service'
import { ImageProcessingService } from './services/image-processing.service'
import { STORAGE_SERVICE } from './interfaces/storage.interface'

@Module({
    imports: [
        ConfigModule,
        BullModule.registerQueue({
            name: 'file-cleanup'
        })
    ],
    providers: [
        {
            provide: STORAGE_SERVICE,
            useFactory: (configService: ConfigService) => {
                const storageType = configService.get<string>('upload.storageType') || 'local'

                if (storageType === 's3') {
                    return new S3StorageService(configService)
                }

                return new LocalStorageService(configService)
            },
            inject: [ConfigService]
        },
        ImageProcessingService,
        UploadService
    ],
    exports: [UploadService, ImageProcessingService, BullModule]
})
export class UploadModule {}
