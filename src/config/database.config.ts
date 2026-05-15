import { registerAs } from '@nestjs/config'
import { parseIntSafe } from '@/shared/utils'

export default registerAs('database', () => ({
    host: process.env.DB_HOST || 'localhost',
    port: parseIntSafe(process.env.DB_PORT, 5333),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'test_app_db'
}))
