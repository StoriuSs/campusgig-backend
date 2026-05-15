import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { MetricsService } from '../../monitoring/metrics.service'

/**
 * Factory function to create an extended Prisma client with monitoring and best practices.
 */
export function createExtendedPrismaClient(metrics: MetricsService) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const client = new PrismaClient({ adapter })

    return client.$extends({
        query: {
            $allModels: {
                async $allOperations({
                    operation,
                    args,
                    query
                }: {
                    operation: string
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    args: any
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    query: (args: any) => Promise<any>
                }) {
                    const start = Date.now()
                    try {
                        const result = await query(args)
                        const duration = Date.now() - start
                        metrics.recordDbQuery(operation, duration)
                        return result
                    } catch (error) {
                        const duration = Date.now() - start
                        metrics.recordDbQuery(operation, duration)
                        throw error
                    }
                }
            }
        }
    })
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>

/**
 * This class serves as the injection token for the Prisma service.
 * In the module, we provide a factory that returns the extended client instance.
 * We use an interface with the same name to merge types and provide full autocompletion.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface PrismaService extends ExtendedPrismaClient {}
@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PrismaService {
    constructor() {
        // The actual instance is returned by the factory in PrismaModule
    }
}

/**
 * Handles the database connection lifecycle.
 * Since the extended client is an instance, we use a separate service to manage its lifecycle.
 */
@Injectable()
export class PrismaLifecycleService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaLifecycleService.name)

    constructor(@Inject(PrismaService) private readonly prisma: ExtendedPrismaClient) {}

    async onModuleInit() {
        await this.prisma.$connect()
        this.logger.log('Prisma connected to database')
    }

    async onModuleDestroy() {
        console.log('🗄️  Closing database connections...')
        await this.prisma.$disconnect()
        console.log('✅ Database connections closed')
    }
}
