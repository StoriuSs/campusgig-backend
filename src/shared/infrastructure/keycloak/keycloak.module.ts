import { Global, Module } from '@nestjs/common'
import { KeycloakAdminProvider } from './keycloak-admin.provider'

@Global()
@Module({
    providers: [KeycloakAdminProvider],
    exports: [KeycloakAdminProvider]
})
export class KeycloakModule {}
