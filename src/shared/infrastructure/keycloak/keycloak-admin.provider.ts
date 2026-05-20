import { Provider, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import KcAdminClient from '@keycloak/keycloak-admin-client'

export const KEYCLOAK_ADMIN_CLIENT = 'KEYCLOAK_ADMIN_CLIENT'

export const KeycloakAdminProvider: Provider = {
    provide: KEYCLOAK_ADMIN_CLIENT,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
        const logger = new Logger('KeycloakAdminProvider')
        const internalUrl = configService.get<string>('keycloak.internalUrl')!

        const kcAdminClient = new KcAdminClient({
            baseUrl: internalUrl,
            realmName: 'master' // Admin authentication usually happens against the master realm. We'll set the target realm later.
        })

        // Retry logic for Keycloak authentication since it takes a while to boot up.
        // Cold-boot Keycloak on a small VPS can take 60-90s before it accepts admin
        // requests. 30 × 5s = 150s gives us comfortable headroom. Without this, the
        // app starts, races against Keycloak's startup, and gives up before Keycloak
        // is ready — which then crashes the container into a restart loop.
        const maxRetries = 30
        const retryDelay = 5000 // 5 seconds

        logger.log(`Connecting to Keycloak admin API at ${internalUrl}...`)

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Authenticate as admin
                await kcAdminClient.auth({
                    username: configService.get<string>('KEYCLOAK_ADMIN_USER', 'admin'),
                    password: configService.get<string>('KEYCLOAK_ADMIN_PASSWORD', 'admin'),
                    grantType: 'password',
                    clientId: 'admin-cli'
                })

                logger.log('Successfully authenticated with Keycloak Admin API')
                break // Success! Break out of the loop
            } catch (error) {
                const errMsg = (error as Error)?.message || String(error)
                if (attempt === maxRetries) {
                    logger.error(`Failed to authenticate with Keycloak after ${maxRetries} attempts`, error)
                    throw error
                }
                // Surface the actual error reason so "not ready yet" isn't opaque.
                // Common values: ECONNREFUSED (Keycloak not up), 401 (wrong creds),
                // ENOTFOUND (wrong host), getaddrinfo (DNS).
                logger.warn(
                    `Keycloak auth failed (attempt ${attempt}/${maxRetries}): ${errMsg}. Retrying in ${retryDelay / 1000}s...`
                )
                await new Promise((resolve) => setTimeout(resolve, retryDelay))
            }
        }

        // Set the active realm for subsequent API calls
        kcAdminClient.setConfig({
            realmName: configService.get<string>('keycloak.realm', 'testapp')
        })

        return kcAdminClient
    }
}
