import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { PrismaService } from '@/shared/infrastructure/persistence/database/prisma.service'
import type { KeycloakTokenPayload } from '@/shared/types'

// Re-uses the same cache key shape as KeycloakAuthGuard so the warm cache from
// the user's HTTP requests applies to their socket connection too.
function cacheKey(keycloakId: string, isAdmin: boolean): string {
    return `user:keycloak:${keycloakId}:a${isAdmin ? '1' : '0'}`
}

@Injectable()
export class WsTokenAuthenticator {
    private readonly logger = new Logger(WsTokenAuthenticator.name)
    private readonly jwks: ReturnType<typeof createRemoteJWKSet>
    private readonly issuer: string
    private readonly audience: string

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {
        this.jwks = createRemoteJWKSet(new URL(this.config.get<string>('keycloak.jwksUri')!))
        this.issuer = this.config.get<string>('keycloak.issuer')!
        this.audience = this.config.get<string>('keycloak.clientId')!
    }

    // Returns the local user's `dbId` or null if the token is missing/invalid.
    async authenticate(token: string | undefined): Promise<string | null> {
        if (!token) return null
        try {
            const { payload } = await jwtVerify(token, this.jwks, {
                issuer: this.issuer,
                audience: this.audience
            })
            const kc = payload as KeycloakTokenPayload
            const keycloakId = kc.sub
            const isAdmin = (kc.realm_access?.roles ?? []).includes('admin')

            // Hot-path: try cache first to mirror the HTTP guard's behavior.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cached = (await this.cache.get(cacheKey(keycloakId, isAdmin))) as any
            if (cached?.dbId) return cached.dbId as string

            const user = await this.prisma.user.findUnique({
                where: { keycloakId },
                select: { id: true, deletedAt: true }
            })
            if (!user || user.deletedAt) return null
            return user.id
        } catch (err) {
            this.logger.debug(`WS token verify failed: ${(err as Error).message}`)
            return null
        }
    }
}
