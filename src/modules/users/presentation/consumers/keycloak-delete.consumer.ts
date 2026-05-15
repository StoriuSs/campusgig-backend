import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import KcAdminClient from '@keycloak/keycloak-admin-client'

/**
 * Keycloak Delete Consumer — Inbound Adapter
 *
 * Receives BullMQ jobs to hard-delete users from Keycloak.
 * This is an inbound adapter (like a controller, but for queue messages).
 */
@Processor('keycloak-sync')
export class KeycloakDeleteConsumer extends WorkerHost {
    private readonly logger = new Logger(KeycloakDeleteConsumer.name)

    constructor(private readonly configService: ConfigService) {
        super()
    }

    async process(job: Job<{ keycloakId: string }>): Promise<void> {
        const { keycloakId } = job.data

        this.logger.log(`Processing hard-delete for keycloak user: ${keycloakId}`)

        try {
            // Background jobs must NOT use the singleton KcAdminClient!
            // Create a fresh, isolated client for each job execution.
            const host = this.configService.get<string>('keycloak.host', 'localhost')
            const port = this.configService.get<number>('keycloak.port', 8080)

            const isolatedClient = new KcAdminClient({
                baseUrl: `http://${host}:${port}`,
                realmName: 'master'
            })

            // Authenticate admin client against the master realm
            await isolatedClient.auth({
                username: this.configService.get<string>('KEYCLOAK_ADMIN_USER', 'admin'),
                password: this.configService.get<string>('KEYCLOAK_ADMIN_PASSWORD', 'admin'),
                grantType: 'password',
                clientId: 'admin-cli'
            })

            // Switch to target realm
            isolatedClient.setConfig({
                realmName: this.configService.get<string>('keycloak.realm', 'testapp')
            })

            // Hard delete in Keycloak
            await isolatedClient.users.del({ id: keycloakId })

            this.logger.log(`Successfully hard-deleted keycloak user: ${keycloakId}`)
        } catch (error) {
            this.logger.error(`Failed to hard-delete keycloak user ${keycloakId}. BullMQ will retry.`, error)
            throw error
        }
    }
}
