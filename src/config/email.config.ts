import { registerAs } from '@nestjs/config'
import { parseIntSafe } from '@/shared/utils'

export default registerAs('email', () => ({
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseIntSafe(process.env.EMAIL_PORT, 587),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Test App',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@testapp.com'
}))
