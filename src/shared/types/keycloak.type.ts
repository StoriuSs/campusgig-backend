import { JWTPayload } from 'jose'

/**
 * Keycloak Token Payload
 * Structure of claims in the decoded Keycloak JWT
 */
export interface KeycloakTokenPayload extends JWTPayload {
    sub: string // Keycloak user ID
    email?: string
    email_verified?: boolean
    name?: string
    preferred_username?: string
    given_name?: string
    family_name?: string
    realm_access?: {
        roles: string[]
    }
    resource_access?: {
        [clientId: string]: {
            roles: string[]
        }
    }
}

/**
 * User data extracted from Keycloak token
 */
export interface KeycloakUserData {
    id: string // Keycloak user ID (sub claim)
    email: string
    username: string // preferred_username claim
    name: string
    emailVerified: boolean
    roles: string[] // From realm_access.roles
}

/**
 * User data from local database
 */
export interface LocalUserData {
    dbId: string // Local database user ID
    // Profile / searchable fields stored locally when needed
    username?: string
    email?: string
    displayName?: string
    avatarUrl?: string
    bio?: string
    hasSetUsername?: boolean
}

/**
 * Authenticated Keycloak User
 * Combined user object attached to request.user by KeycloakAuthGuard
 * Contains both Keycloak token data and local database preferences
 */
export interface AuthenticatedKeycloakUser extends KeycloakUserData {
    local: LocalUserData
}
