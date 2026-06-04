import { Module } from '@nestjs/common'

import { PublicStatsController } from './presentation/http/public-stats.controller'

// PrismaService + cache are global; the controller reads three aggregates directly.
@Module({ controllers: [PublicStatsController] })
export class StatsModule {}
