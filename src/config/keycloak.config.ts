import { registerAs } from '@nestjs/config'
import { parseIntSafe } from '@/shared/utils'

export default registerAs('keycloak', () => {
    const host = process.env.KEYCLOAK_HOST || 'localhost'
    const port = parseIntSafe(process.env.KEYCLOAK_PORT, 8080)
    const realm = process.env.KEYCLOAK_REALM || 'testapp'

    // Internal URL — used for network calls (JWKS fetching, admin API).
    // Inside Docker this is the container service name (e.g. keycloak:8080).
    const internalUrl = `http://${host}:${port}`

    // Public URL — used for JWT issuer validation.
    // Must match the URL the frontend uses to obtain tokens.
    // Falls back to internalUrl when not in Docker (local dev without Docker).
    const publicUrl = process.env.KEYCLOAK_PUBLIC_URL || internalUrl

    return {
        host,
        port,
        realm,
        clientId: process.env.KEYCLOAK_CLIENT_ID || 'testapp',
        internalUrl,
        publicUrl,
        issuer: `${publicUrl}/realms/${realm}`,
        jwksUri: `${internalUrl}/realms/${realm}/protocol/openid-connect/certs`
    }
})
