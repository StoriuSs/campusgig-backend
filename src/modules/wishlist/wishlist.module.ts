import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { GigsModule } from '@/modules/gigs/gigs.module'

import { WISHLIST_REPOSITORY_PORT } from './domain/ports/wishlist.repository.port'
import { SaveGigHandler, UnsaveGigHandler, GetWishlistHandler } from './application'
import { PrismaWishlistRepository } from './infrastructure/persistence/prisma-wishlist.repository'
import { WishlistController } from './presentation'

const CommandHandlers = [SaveGigHandler, UnsaveGigHandler]
const QueryHandlers = [GetWishlistHandler]

@Module({
    imports: [CqrsModule, GigsModule],
    controllers: [WishlistController],
    providers: [
        { provide: WISHLIST_REPOSITORY_PORT, useClass: PrismaWishlistRepository },
        ...CommandHandlers,
        ...QueryHandlers
    ]
})
export class WishlistModule {}
