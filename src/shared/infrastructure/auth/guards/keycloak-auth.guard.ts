import { Injectable, CanActivate, ExecutionContext, HttpStatus, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { IS_PUBLIC_KEY } from '@/shared/presentation/decorators'
import { CustomException } from '@/shared/presentation/exceptions'
import { ERROR_CODES, ERROR_TYPES, MESSAGES } from '@/shared/constants'
import { PrismaService } from '../../persistence/database/prisma.service'
import { KeycloakTokenPayload, KeycloakUserData, LocalUserData, AuthenticatedKeycloakUser } from '@/shared/types'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { isMetricsRequest } from '@/shared/utils'

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
    private readonly logger = new Logger(KeycloakAuthGuard.name)
    private jwks: ReturnType<typeof createRemoteJWKSet>
    private issuer: string
    private audience: string

    constructor(
        private readonly configService: ConfigService,
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {
        const jwksUri = this.configService.get<string>('keycloak.jwksUri')!
        this.issuer = this.configService.get<string>('keycloak.issuer')!
        this.audience = this.configService.get<string>('keycloak.clientId')!

        // Create JWKS client (caches keys automatically)
        this.jwks = createRemoteJWKSet(new URL(jwksUri))
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if route is public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass()
        ])

        if (isPublic) {
            return true
        }

        const request = context.switchToHttp().getRequest()

        // Allow /metrics endpoint for Prometheus scraping
        if (isMetricsRequest(request.url)) {
            return true
        }

        const token = this.extractTokenFromHeader(request)

        if (!token) {
            throw new CustomException({
                code: ERROR_CODES.AUTH_TOKEN_MISSING,
                type: ERROR_TYPES.AUTH_TOKEN_MISSING,
                message: MESSAGES.AUTH.TOKEN_MISSING,
                status: HttpStatus.UNAUTHORIZED
            })
        }

        try {
            // Verify JWT using Keycloak's public keys
            const { payload } = await jwtVerify(token, this.jwks, {
                issuer: this.issuer,
                audience: this.audience
            })

            const keycloakPayload = payload as KeycloakTokenPayload

            // Extract Keycloak user data from token
            const keycloakUser = this.extractKeycloakUser(keycloakPayload)

            // JIT Provisioning: Sync user to local database
            const localUser = await this.syncUserToDatabase(keycloakUser)

            // Attach combined user data to request
            request.user = {
                ...keycloakUser,
                local: localUser
            } as AuthenticatedKeycloakUser

            return true
        } catch (error) {
            this.logger.error(`JWT verification failed: ${error}`)
            if (token) {
                try {
                    const parts = token.split('.')
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
                    this.logger.error(`Token iss: ${payload.iss} | Expected: ${this.issuer}`)
                    this.logger.error(`Token aud: ${payload.aud} | Expected: ${this.audience}`)
                    this.logger.error(`Token azp: ${payload.azp}`)
                } catch {
                    /* ignore */
                }
            }
            throw new CustomException({
                code: ERROR_CODES.AUTH_TOKEN_INVALID,
                type: ERROR_TYPES.AUTH_TOKEN_INVALID,
                message: MESSAGES.AUTH.TOKEN_INVALID,
                status: HttpStatus.UNAUTHORIZED
            })
        }
    }

    private extractTokenFromHeader(request: { headers: { authorization?: string } }): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? []
        return type === 'Bearer' ? token : undefined
    }

    private extractKeycloakUser(payload: KeycloakTokenPayload): KeycloakUserData {
        return {
            id: payload.sub, // Use this as keycloakId in User table
            username: payload.preferred_username || payload.email || 'unknown',
            email: payload.email || '',
            name: payload.name || payload.preferred_username || 'Unknown User',
            roles: payload.realm_access?.roles || [],
            emailVerified: payload.email_verified || false
        }
    }

    /**
     * JIT (Just-in-Time) Provisioning: Sync Keycloak user to local database
     * - Creates new user if they don't exist (first login after registration)
     * - Returns local user preferences
     * - Caches the result to reduce database load
     */
    private async syncUserToDatabase(keycloakUser: KeycloakUserData): Promise<LocalUserData> {
        // Cache key includes the admin-role bit so a role change in Keycloak
        // forces a cache miss → reconciliation runs on the next request.
        const tokenHasAdminRoleForCacheKey = keycloakUser.roles.includes('admin') ? '1' : '0'
        const cacheKey = `user:keycloak:${keycloakUser.id}:a${tokenHasAdminRoleForCacheKey}`

        try {
            const cachedUser = await this.cache.get(cacheKey)
            if (cachedUser) {
                return cachedUser as LocalUserData
            }
        } catch (_error) {
            this.logger.error(`Cache get failed: ${(_error as Error).message}`)
        }
        // check if an user with the same keycloakId exists
        let user = await this.prisma.user.findUnique({
            where: { keycloakId: keycloakUser.id }
        })
        // if the user exists BUT was soft-deleted --> the keycloak account hasn't been deleted yet, either it's
        // still being scheduled for deletion or there is an error that caused the failed deletion. Either way, we shouldn't let this account in
        if (user && user.deletedAt) {
            throw new CustomException({
                code: ERROR_CODES.AUTH_ACCOUNT_DISABLED,
                type: ERROR_TYPES.AUTH_ACCOUNT_DISABLED,
                message: 'Account has been scheduled for deletion.',
                status: HttpStatus.FORBIDDEN
            })
        }

        const tokenHasAdminRole = keycloakUser.roles.includes('admin')

        if (!user) {
            // First-time JIT provisioning. If the token carries the `admin` realm role,
            // mark the row as admin AND set hasSetUsername=true so the buyer/seller
            // first-login flow (UsernameSetupModal) never gates them.
            user = await this.prisma.user.create({
                data: {
                    keycloakId: keycloakUser.id,
                    email: keycloakUser.email,
                    ...(keycloakUser.name ? { displayName: keycloakUser.name } : {}),
                    ...(tokenHasAdminRole ? { isAdmin: true, hasSetUsername: true } : {})
                }
            })
        } else {
            // Reconcile drift on every authed request. Only write when something
            // actually differs — keeps the hot path cheap.
            const patch: { email?: string; isAdmin?: boolean; hasSetUsername?: boolean } = {}
            if (user.email !== keycloakUser.email) patch.email = keycloakUser.email
            if (user.isAdmin !== tokenHasAdminRole) {
                patch.isAdmin = tokenHasAdminRole
                // Promotion: also flip hasSetUsername so the modal doesn't bounce them
                // on next reload. We don't undo this on demotion — if a user lost admin,
                // they may want to use a username they had pre-promotion.
                if (tokenHasAdminRole && !user.hasSetUsername) {
                    patch.hasSetUsername = true
                }
            }
            if (Object.keys(patch).length > 0) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: patch
                })
            }
        }

        const localUserData: LocalUserData = {
            dbId: user.id,
            username: user.username ?? undefined,
            email: user.email ?? undefined,
            displayName: user.displayName ?? undefined,
            avatarUrl: user.avatarUrl ?? undefined,
            bio: user.bio ?? undefined,
            hasSetUsername: user.hasSetUsername ?? false,
            isAdmin: user.isAdmin
        }

        try {
            // Cache for 1 hour (default) or use config
            const ttl = this.configService.get<number>('redis.ttl') || 3600
            await this.cache.set(cacheKey, localUserData, ttl * 1000)
        } catch (_error) {
            this.logger.error(`Cache set failed: ${(_error as Error).message}`)
        }

        return localUserData
    }
}
