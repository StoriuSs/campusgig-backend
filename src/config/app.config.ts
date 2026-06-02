import { registerAs } from '@nestjs/config'
import { parseIntSafe } from '@/shared/utils'

export default registerAs('app', () => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    name: process.env.APP_NAME || 'Test App',
    baseUrl: process.env.BASE_URL || `http://localhost:${parseInt(process.env.PORT || '3000', 10)}`,
    // Frontend origin for deep-links in notification emails.
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8000',
    gracefulShutdownTimeout: parseIntSafe(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS, 5000), // 5s default
    bullBoardUser: process.env.BULL_BOARD_USER || 'admin',
    bullBoardPassword: process.env.BULL_BOARD_PASSWORD || 'admin'
}))
