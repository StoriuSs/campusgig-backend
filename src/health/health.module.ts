import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController, PrismaHealthIndicator, RedisHealthIndicator } from './health.controller'
import { ThrottlerHealthIndicator } from './throttler.health'

@Module({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [PrismaHealthIndicator, RedisHealthIndicator, ThrottlerHealthIndicator]
})
export class HealthModule {}
