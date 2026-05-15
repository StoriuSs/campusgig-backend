import { registerAs } from '@nestjs/config'

export default registerAs('cors', () => ({
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true'
}))
