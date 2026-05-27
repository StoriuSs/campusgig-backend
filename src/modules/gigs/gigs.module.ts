import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { UploadModule } from '@/shared/infrastructure'

import { GIG_REPOSITORY_PORT } from './domain'
import {
    GIG_STORAGE_PORT,
    ListMyGigsHandler,
    GetMyGigByIdHandler,
    CreateGigHandler,
    UpdateGigHandler,
    PauseGigHandler,
    ResumeGigHandler,
    SoftDeleteGigHandler,
    UploadGigImageHandler,
    DeleteGigImageHandler,
    ReorderGigImagesHandler
} from './application'
import { PrismaGigRepository, GigStorageAdapter } from './infrastructure'
import { GigsController } from './presentation'

// Re-export the categories repository binding via the CategoriesModule import? No —
// CategoriesModule provides CATEGORY_REPOSITORY_PORT, and we just import the module.
import { CategoriesModule } from '@/modules/categories/categories.module'

const CommandHandlers = [
    CreateGigHandler,
    UpdateGigHandler,
    PauseGigHandler,
    ResumeGigHandler,
    SoftDeleteGigHandler,
    UploadGigImageHandler,
    DeleteGigImageHandler,
    ReorderGigImagesHandler
]
const QueryHandlers = [ListMyGigsHandler, GetMyGigByIdHandler]

@Module({
    imports: [CqrsModule, UploadModule, CategoriesModule],
    controllers: [GigsController],
    providers: [
        { provide: GIG_REPOSITORY_PORT, useClass: PrismaGigRepository },
        { provide: GIG_STORAGE_PORT, useClass: GigStorageAdapter },
        ...CommandHandlers,
        ...QueryHandlers
    ]
})
export class GigsModule {}
