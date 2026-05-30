// Synthetic user row that owns the platform's 20% take of every completed
// order. Created once by the seed script with `keycloakId =
// 'platform-fee-collector'` (no Keycloak realm user maps to this id, so it
// can never log in). The wallet's escrow-release flow credits its
// `walletBalance` as the destination of the platform share.
//
// Audit any user-facing query that lists / searches users to make sure this
// row is excluded — it has `isAdmin = false` but it isn't a real human.

export const PLATFORM_FEE_COLLECTOR_KEYCLOAK_ID = 'platform-fee-collector'
export const PLATFORM_FEE_COLLECTOR_USER_ID = '00000000-0000-0000-0000-000000000001'
export const PLATFORM_FEE_COLLECTOR_DISPLAY_NAME = 'CampusGig Platform'
