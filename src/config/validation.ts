import Joi from 'joi'

export const validationSchema = Joi.object({
    // app.config.ts
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    API_PREFIX: Joi.string().default('api/v1'),
    GRACEFUL_SHUTDOWN_TIMEOUT_MS: Joi.number().default(5000),

    // cors.config.ts
    CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
    CORS_CREDENTIALS: Joi.boolean().default(false),

    // database.config.ts
    DATABASE_URL: Joi.string().required(),
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5333),
    DB_NAME: Joi.string().required(),
    DB_USERNAME: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),

    // email.config.ts
    EMAIL_HOST: Joi.string(),
    EMAIL_PORT: Joi.number().default(587),
    EMAIL_SECURE: Joi.boolean().default(false),
    EMAIL_USER: Joi.string(),
    EMAIL_PASSWORD: Joi.string(),
    EMAIL_FROM: Joi.string().default('noreply@example.com'),

    // redis.config.ts
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow('').optional(),
    REDIS_TTL: Joi.number().default(3600),

    // cache.config.ts (2-Layer: In-memory + Redis)
    CACHE_TTL: Joi.number().default(3600),
    CACHE_LRU_SIZE: Joi.number().default(500),

    // throttle.config.ts
    THROTTLE_TTL: Joi.number().default(60),
    THROTTLE_LIMIT: Joi.number().default(10),

    // upload.config.ts
    STORAGE_TYPE: Joi.string().valid('local', 's3').default('local'),
    UPLOAD_DEST: Joi.string().default('./uploads'),
    MAX_FILE_SIZE: Joi.number().default(5242880),
    ALLOWED_FILE_TYPES: Joi.string().default('image/jpeg,image/png,image/gif,application/pdf'),
    AWS_REGION: Joi.string().when('STORAGE_TYPE', {
        is: 's3',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    AWS_ACCESS_KEY_ID: Joi.string().when('STORAGE_TYPE', {
        is: 's3',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    AWS_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_TYPE', {
        is: 's3',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    AWS_S3_BUCKET: Joi.string().when('STORAGE_TYPE', {
        is: 's3',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),

    // pino.config.ts
    LOG_LEVEL: Joi.string().default('info'),
    LOG_DIR: Joi.string().default('./logs'),

    // keycloak
    KEYCLOAK_HOST: Joi.string().default('localhost'),
    KEYCLOAK_PORT: Joi.number().default(8080),
    KEYCLOAK_HOSTNAME: Joi.string().default('localhost'),
    KEYCLOAK_REALM: Joi.string().required(),
    KEYCLOAK_CLIENT_ID: Joi.string().required(),
    KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
    KEYCLOAK_ADMIN_USER: Joi.string().default('admin'),
    KEYCLOAK_ADMIN_PASSWORD: Joi.string().required(),
    KEYCLOAK_DB_NAME: Joi.string().default('keycloak'),

    // timeout.config.ts
    REQUEST_TIMEOUT_MS: Joi.number().default(30000)
})
