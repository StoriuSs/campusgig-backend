// Synthetic user that owns the platform's 20% fee. keycloakId
// 'platform-fee-collector' never logs in. Exclude from user listings.
export const PLATFORM_FEE_COLLECTOR_KEYCLOAK_ID = 'platform-fee-collector'
export const PLATFORM_FEE_COLLECTOR_USER_ID = '00000000-0000-0000-0000-000000000001'
export const PLATFORM_FEE_COLLECTOR_DISPLAY_NAME = 'CampusGig Platform'

// Sentinel usernames for system accounts. User.username has a unique
// constraint and dev → prod export serializes NULLs as empty strings (which
// collide), so every system row gets a unique non-null handle. The `__`
// prefix and `admin-{12hex}` shape are reserved — see isReservedSystemUsername.
export const PLATFORM_FEE_COLLECTOR_USERNAME = '__platform__'

export const ADMIN_USERNAME_PREFIX = 'admin-'

// Deterministic so re-provisioning the same admin yields the same row.
export function adminSentinelUsername(keycloakId: string): string {
    const hex = keycloakId.replace(/-/g, '').toLowerCase().slice(0, 12)
    return `${ADMIN_USERNAME_PREFIX}${hex}`
}

export function isReservedSystemUsername(username: string): boolean {
    if (username === PLATFORM_FEE_COLLECTOR_USERNAME) return true
    if (username.startsWith('__')) return true
    if (/^admin-[a-f0-9]{12}$/.test(username)) return true
    return false
}
