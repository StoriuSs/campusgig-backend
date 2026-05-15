import { registerAs } from '@nestjs/config'

export default registerAs('prometheus', () => ({
    enabled: process.env.PROMETHEUS_ENABLED !== 'false',
    defaultMetrics: true,
    defaultLabels: {
        app: 'nestjs-starter',
        environment: process.env.NODE_ENV || 'development'
    }
}))
