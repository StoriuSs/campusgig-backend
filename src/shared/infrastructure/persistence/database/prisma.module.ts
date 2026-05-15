import { Module, Global } from '@nestjs/common'
import { PrismaService, PrismaLifecycleService, createExtendedPrismaClient } from './prisma.service'
import { MetricsService } from '../../monitoring/metrics.service'

@Global()
@Module({
    providers: [
        {
            provide: PrismaService,
            inject: [MetricsService],
            useFactory: (metrics: MetricsService) => {
                return createExtendedPrismaClient(metrics)
            }
        },
        PrismaLifecycleService
    ],
    exports: [PrismaService]
})
export class PrismaModule {}
