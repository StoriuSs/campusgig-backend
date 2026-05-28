import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { GigsModule } from '@/modules/gigs/gigs.module'

import { PUBLIC_GIGS_REPOSITORY_PORT } from './domain/ports/public-gigs.repository.port'
import { BrowseGigsHandler, GetPublicGigByIdHandler, InvalidatePublicGigsCacheHandler } from './application'
import { PrismaPublicGigsRepository } from './infrastructure/persistence/prisma-public-gigs.repository'
import { PublicGigsController } from './presentation'

const QueryHandlers = [BrowseGigsHandler, GetPublicGigByIdHandler]
const EventHandlers = [InvalidatePublicGigsCacheHandler]

@Module({
    imports: [CqrsModule, GigsModule],
    controllers: [PublicGigsController],
    providers: [
        { provide: PUBLIC_GIGS_REPOSITORY_PORT, useClass: PrismaPublicGigsRepository },
        ...QueryHandlers,
        ...EventHandlers
    ]
})
export class PublicGigsModule {}
