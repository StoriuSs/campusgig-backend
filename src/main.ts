import { NestFactory } from '@nestjs/core'
import { HttpStatus, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'
import { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import * as swaggerUi from 'swagger-ui-express'
import * as YAML from 'yamljs'
import * as path from 'path'
import basicAuth from 'express-basic-auth'
import { AppModule } from './app.module'
import { CustomException } from '@/shared/presentation/exceptions/custom.exception'
import { ERROR_CODES, ERROR_TYPES } from '@/shared/constants'
import { SnakeToCamelPipe } from '@/shared/presentation/pipes'

import { ExpressAdapter } from '@bull-board/express'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { getQueueToken } from '@nestjs/bullmq'

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule)

    // Get config service
    const configService = app.get(ConfigService)

    // Use Pino logger FIRST - this ensures proper log ordering
    app.useLogger(app.get(Logger))

    // Enable URI versioning (e.g., /api/v1/users)
    app.enableVersioning({
        type: 0, // VersioningType.URI
        defaultVersion: '1'
    })

    // Global prefix
    const apiPrefix = configService.get<string>('app.apiPrefix')!
    app.setGlobalPrefix(apiPrefix)

    // CORS
    const corsOrigins = configService.get<string[]>('cors.origins')
    const corsCredentials = configService.get<boolean>('cors.credentials')
    app.enableCors({
        origin: corsOrigins,
        credentials: corsCredentials
    })

    // Cookie parser - must be before routes
    app.use(cookieParser())

    // Security - Helmet with custom CSP for images
    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'blob:', '*'],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"]
                }
            }
        })
    )

    // Serve static files for uploads
    app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
        prefix: '/uploads/'
    })

    // Global validation pipe

    app.useGlobalPipes(
        new SnakeToCamelPipe(), // Convert snake_case to camelCase before validation
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
                excludeExtraneousValues: false // Allow properties without @Expose() decorator
            },
            skipMissingProperties: false,
            stopAtFirstError: false,
            exceptionFactory: (validationErrors) => {
                // Flatten error messages
                const errors = validationErrors.map((err) => ({
                    property: err.property,
                    constraints: err.constraints,
                    value: err.value
                }))
                return new CustomException({
                    code: ERROR_CODES.VALIDATION_ERROR,
                    type: ERROR_TYPES.VALIDATION_ERROR,
                    message: 'Validation failed',
                    errors,
                    status: HttpStatus.UNPROCESSABLE_ENTITY
                })
            }
        })
    )

    // Load and serve OpenAPI documentation
    try {
        const swaggerDocument = YAML.load(path.join(process.cwd(), 'swagger-docs.yaml'))
        app.use(
            '/api-docs',
            swaggerUi.serve,
            swaggerUi.setup(swaggerDocument, {
                customCss: '.swagger-ui .topbar { display: none }',
                customSiteTitle: 'NestJS REST API Documentation',
                swaggerOptions: {
                    persistAuthorization: true
                }
            })
        )
    } catch (error) {
        console.warn('Could not load swagger-docs.yaml file:', error.message)
    }

    // Initialize Bull Board dashboard directly on Express bypassing NestJS routing prefix
    const serverAdapter = new ExpressAdapter()
    serverAdapter.setBasePath('/admin/queues')

    // Extract the initialized BullMQ queue from the NestJS context
    const keycloakQueue = app.get(getQueueToken('keycloak-sync'))

    createBullBoard({
        queues: [new BullMQAdapter(keycloakQueue)],
        serverAdapter
    })

    // Mount to Express HTTP server (runs independently of api routes)
    const bullBoardUser = configService.get<string>('app.bullBoardUser', 'admin')
    const bullBoardPassword = configService.get<string>('app.bullBoardPassword', 'admin')

    app.use(
        '/admin/queues',
        basicAuth({
            users: {
                [bullBoardUser]: bullBoardPassword
            },
            challenge: true,
            realm: 'BullMQ Dashboard'
        }),
        serverAdapter.getRouter()
    )

    // Start server
    const port = configService.get<number>('app.port')
    const nodeEnv = configService.get<string>('app.nodeEnv')

    // Enable graceful shutdown - this triggers onModuleDestroy() lifecycle hooks
    app.enableShutdownHooks()

    await app.listen(port!)

    console.log(`
    🚀 Application is running!
    📝 Environment: ${nodeEnv}
    🌐 URL: http://localhost:${port}
    🔧 BullMQ Dashboard: http://localhost:${port}/admin/queues
    📚 API Docs: http://localhost:${port}/api-docs
    🔧 API Endpoints: /${apiPrefix}/v1/*
  `)

    // Log when shutdown signal is received
    process.on('SIGTERM', () => console.log('\n🛑 SIGTERM received, starting graceful shutdown...'))
    process.on('SIGINT', () => console.log('\n🛑 SIGINT received, starting graceful shutdown...'))
}

bootstrap()
