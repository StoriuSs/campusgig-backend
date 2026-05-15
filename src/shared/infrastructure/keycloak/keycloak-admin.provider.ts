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

        // Retry logic for Keycloak authentication since it takes a while to boot up
        const maxRetries = 10
        const retryDelay = 5000 // 5 seconds

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
                if (attempt === maxRetries) {
                    logger.error(`Failed to authenticate with Keycloak after ${maxRetries} attempts`, error)
                    throw error
                }
                logger.warn(
                    `Keycloak not ready yet (attempt ${attempt}/${maxRetries}). Retrying in ${retryDelay / 1000}s...`
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
