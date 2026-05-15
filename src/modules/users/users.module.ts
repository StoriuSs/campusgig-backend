import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { BullModule } from '@nestjs/bullmq'
import { UploadModule } from '@/shared/infrastructure'

// Domain
import { USER_REPOSITORY_PORT } from './domain'

// Application
import {
    STORAGE_PORT,
    CACHE_PORT,
    UpdateProfileHandler,
    SetUsernameHandler,
    UploadAvatarHandler,
    DeleteAccountHandler,
    CheckUsernameHandler,
    InvalidateCacheHandler,
    CleanupOldAvatarHandler,
    EnqueueKeycloakDeleteHandler
} from './application'

// Infrastructure
import { PrismaUserRepository, RedisCacheAdapter, UploadStorageAdapter } from './infrastructure'

// Presentation (Inbound Adapters)
import { UsersController, FileCleanupConsumer, KeycloakDeleteConsumer } from './presentation'

// Command Handlers array
const CommandHandlers = [UpdateProfileHandler, SetUsernameHandler, UploadAvatarHandler, DeleteAccountHandler]

// Query Handlers array
const QueryHandlers = [CheckUsernameHandler]

// Event Handlers array
const EventHandlers = [InvalidateCacheHandler, CleanupOldAvatarHandler, EnqueueKeycloakDeleteHandler]

@Module({
    imports: [CqrsModule, UploadModule, BullModule.registerQueue({ name: 'keycloak-sync' }, { name: 'file-cleanup' })],
    controllers: [UsersController],
    providers: [
        // Port → Adapter bindings (Hexagonal Architecture wiring)
        { provide: USER_REPOSITORY_PORT, useClass: PrismaUserRepository },
        { provide: STORAGE_PORT, useClass: UploadStorageAdapter },
        { provide: CACHE_PORT, useClass: RedisCacheAdapter },

        // CQRS Handlers
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers,

        // Inbound Adapters (Queue Consumers)
        FileCleanupConsumer,
        KeycloakDeleteConsumer
    ]
})
export class UsersModule {}
