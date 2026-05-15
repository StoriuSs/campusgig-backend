import 'dotenv/config' // Load env vars before anything else
import { Params } from 'nestjs-pino'

const logLevel = process.env.LOG_LEVEL || 'info'
// Default to development (pretty logs) unless explicitly set to production
const isDevelopment = process.env.NODE_ENV !== 'production'
// Enable Loki logging (default: true in development if LOKI_HOST is set)
const lokiEnabled = process.env.LOKI_ENABLED !== 'false' && process.env.LOKI_HOST

// Build transport targets
const buildTransports = () => {
    const targets: Array<{
        target: string
        options: Record<string, unknown>
        level?: string
    }> = []

    // Console output (pino-pretty in dev, JSON in prod)
    if (isDevelopment) {
        targets.push({
            target: 'pino-pretty',
            options: {
                singleLine: false,
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname,req.id,req.headers,req.remoteAddress,req.remotePort,res.headers'
            }
        })
    }

    // Loki transport (sends logs to Grafana Loki)
    if (lokiEnabled) {
        targets.push({
            target: 'pino-loki',
            options: {
                host: process.env.LOKI_HOST || 'http://localhost:3100',
                batching: true,
                interval: 5, // Send logs every 5 seconds
                labels: {
                    application: 'nestjs-app',
                    environment: process.env.NODE_ENV || 'development'
                }
            }
        })
    }

    return targets
}

const transports = buildTransports()

export const pinoConfig: Params = {
    pinoHttp: {
        level: logLevel,
        messageKey: 'msg',
        // Use multistream transport when we have targets, otherwise undefined (for production JSON)
        ...(transports.length > 0 && {
            transport: {
                targets: transports
            }
        }),
        customProps: (req) => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            requestId: (req as any)['requestId'],
            context: 'HTTP'
        }),
        autoLogging: false,
        customLogLevel: function (req, res, err) {
            if (res.statusCode >= 400 && res.statusCode < 500) {
                return 'warn'
            } else if (res.statusCode >= 500 || err) {
                return 'error'
            }
            return 'info'
        },
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.confirmPassword',
                'req.body.oldPassword',
                'req.body.newPassword'
            ],
            censor: '[REDACTED]'
        }
    },
    // This tells nestjs-pino to actually use pino-pretty
    forRoutes: []
}
