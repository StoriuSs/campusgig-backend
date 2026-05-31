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
    ReorderGigImagesHandler,
    ApproveGigHandler,
    RejectGigHandler,
    ListAdminGigQueueHandler,
    GetAdminGigByIdHandler,
    GetMyGigStatsHandler
} from './application'
import { PrismaGigRepository, GigStorageAdapter } from './infrastructure'
import { GigsController, AdminGigsController } from './presentation'

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
    ReorderGigImagesHandler,
    ApproveGigHandler,
    RejectGigHandler
]
const QueryHandlers = [
    ListMyGigsHandler,
    GetMyGigByIdHandler,
    ListAdminGigQueueHandler,
    GetAdminGigByIdHandler,
    GetMyGigStatsHandler
]

@Module({
    imports: [CqrsModule, UploadModule, CategoriesModule],
    controllers: [GigsController, AdminGigsController],
    providers: [
        { provide: GIG_REPOSITORY_PORT, useClass: PrismaGigRepository },
        { provide: GIG_STORAGE_PORT, useClass: GigStorageAdapter },
        ...CommandHandlers,
        ...QueryHandlers
    ],
    exports: [GIG_STORAGE_PORT]
})
export class GigsModule {}
